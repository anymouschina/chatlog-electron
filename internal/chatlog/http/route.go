package http

import (
    "bytes"
    "embed"
    "encoding/json"
    "fmt"
    "io"
    "io/fs"
    "net/http"
    "os"
    "path/filepath"
    "strings"
    "time"

    "github.com/sjzar/chatlog/internal/errors"
    "github.com/sjzar/chatlog/internal/chatlog/conf"
    "github.com/sjzar/chatlog/pkg/util"
    "github.com/sjzar/chatlog/pkg/util/dat2img"
    "github.com/sjzar/chatlog/pkg/util/silk"

    "github.com/gin-gonic/gin"
)

// EFS holds embedded file system data for static assets.
//
//go:embed static
var EFS embed.FS

func (s *Service) initRouter() {

	router := s.GetRouter()

	staticDir, _ := fs.Sub(EFS, "static")
	router.StaticFS("/static", http.FS(staticDir))
	router.StaticFileFS("/favicon.ico", "./favicon.ico", http.FS(staticDir))
	router.StaticFileFS("/", "./index.htm", http.FS(staticDir))
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Media
	router.GET("/image/*key", s.GetImage)
	router.GET("/video/*key", s.GetVideo)
	router.GET("/file/*key", s.GetFile)
	router.GET("/voice/*key", s.GetVoice)
	router.GET("/data/*path", s.GetMediaData)

	// MCP Server
	{
		router.GET("/sse", s.mcp.HandleSSE)
		router.POST("/messages", s.mcp.HandleMessages)
		// mcp inspector is shit
		// https://github.com/modelcontextprotocol/inspector/blob/aeaf32f/server/src/index.ts#L155
		router.POST("/message", s.mcp.HandleMessages)
	}

	// API V1 Router
	api := router.Group("/api/v1", s.checkDBStateMiddleware())
	{
		api.GET("/chatlog", s.GetChatlog)
		api.GET("/contact", s.GetContacts)
		api.GET("/chatroom", s.GetChatRooms)
		api.GET("/session", s.GetSessions)
		api.POST("/summarize", s.PostSummarize)
	}

	// Control endpoints (runtime operations)
	ctrl := router.Group("/api/v1/control")
	{
		ctrl.POST("/autodecrypt", s.CtrlAutoDecrypt)
		ctrl.POST("/decrypt", s.CtrlDecrypt)
		ctrl.POST("/config", s.CtrlConfig)
		ctrl.GET("/instances", s.CtrlInstances)
		ctrl.GET("/state", s.CtrlState)
	}

	router.NoRoute(s.NoRoute)
}

// CtrlAutoDecrypt toggles auto decrypt at runtime: {"enable": true|false}
func (s *Service) CtrlAutoDecrypt(c *gin.Context) {
    body := struct{ Enable bool `json:"enable"` }{}
    if err := c.ShouldBindJSON(&body); err != nil {
        errors.Err(c, errors.InvalidArg("enable"))
        return
    }
    if s.wx == nil {
        errors.Err(c, errors.New(nil, http.StatusInternalServerError, "wechat service not available"))
        return
    }
    if body.Enable {
        if err := s.wx.StartAutoDecrypt(); err != nil {
            errors.Err(c, err)
            return
        }
    } else {
        if err := s.wx.StopAutoDecrypt(); err != nil {
            errors.Err(c, err)
            return
        }
    }
    // best-effort update of config if underlying type supports it
    if sc, ok := s.conf.(*conf.ServerConfig); ok {
        sc.AutoDecrypt = body.Enable
    }
    c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CtrlDecrypt triggers full decrypt and reloads DB
func (s *Service) CtrlDecrypt(c *gin.Context) {
    if s.wx == nil {
        errors.Err(c, errors.New(nil, http.StatusInternalServerError, "wechat service not available"))
        return
    }
    s.db.SetDecrypting()
    if err := s.wx.DecryptDBFiles(); err != nil {
        s.db.SetError(err.Error())
        errors.Err(c, err)
        return
    }
    // reload DB to reflect new data
    _ = s.db.Stop()
    if err := s.db.Start(); err != nil {
        s.db.SetError(err.Error())
        errors.Err(c, err)
        return
    }
    s.db.SetReady()
    c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CtrlConfig updates runtime config. Accepts any of: addr,dataDir,dataKey,imgKey,workDir,platform,version
func (s *Service) CtrlConfig(c *gin.Context) {
    payload := struct {
        Addr     string `json:"addr"`
        DataDir  string `json:"dataDir"`
        DataKey  string `json:"dataKey"`
        ImgKey   string `json:"imgKey"`
        WorkDir  string `json:"workDir"`
        Platform string `json:"platform"`
        Version  int    `json:"version"`
    }{}
    if err := c.ShouldBindJSON(&payload); err != nil {
        errors.Err(c, errors.InvalidArg("config"))
        return
    }
    // Only works when underlying conf is ServerConfig
    if sc, ok := s.conf.(*conf.ServerConfig); ok {
        if payload.Addr != "" { sc.HTTPAddr = payload.Addr }
        if payload.DataDir != "" { sc.DataDir = payload.DataDir }
        if payload.DataKey != "" { sc.DataKey = payload.DataKey }
        if payload.ImgKey != "" { sc.ImgKey = payload.ImgKey }
        if payload.WorkDir != "" { sc.WorkDir = payload.WorkDir }
        if payload.Platform != "" { sc.Platform = payload.Platform }
        if payload.Version != 0 { sc.Version = payload.Version }
    }
    // reload DB after config change impacting DB
    _ = s.db.Stop()
    if err := s.db.Start(); err != nil {
        s.db.SetError(err.Error())
        errors.Err(c, err)
        return
    }
    c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CtrlInstances lists running WeChat processes (PID/name/version/dataDir)
func (s *Service) CtrlInstances(c *gin.Context) {
    if s.wx == nil {
        errors.Err(c, errors.New(nil, http.StatusInternalServerError, "wechat service not available"))
        return
    }
    type out struct {
        PID         uint32 `json:"pid"`
        Name        string `json:"name"`
        FullVersion string `json:"full_version"`
        DataDir     string `json:"data_dir"`
    }
    var items []out
    for _, ins := range s.wx.GetWeChatInstances() {
        items = append(items, out{PID: ins.PID, Name: ins.Name, FullVersion: ins.FullVersion, DataDir: ins.DataDir})
    }
    c.JSON(http.StatusOK, gin.H{"items": items})
}

// CtrlState returns current basic server state/config (best-effort)
func (s *Service) CtrlState(c *gin.Context) {
    resp := gin.H{"http_addr": s.conf.GetHTTPAddr()}
    if sc, ok := s.conf.(*conf.ServerConfig); ok {
        resp["data_dir"] = sc.DataDir
        resp["work_dir"] = sc.WorkDir
        resp["platform"] = sc.Platform
        resp["version"] = sc.Version
        resp["auto_decrypt"] = sc.AutoDecrypt
    }
    c.JSON(http.StatusOK, resp)
}

// NoRoute handles 404 Not Found errors. If the request URL starts with "/api"
// or "/static", it responds with a JSON error. Otherwise, it redirects to the root path.
func (s *Service) NoRoute(c *gin.Context) {
	path := c.Request.URL.Path
	switch {
	case strings.HasPrefix(path, "/api"), strings.HasPrefix(path, "/static"):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate, value")
		c.Redirect(http.StatusFound, "/")
	}
}

func (s *Service) GetChatlog(c *gin.Context) {

	q := struct {
		Time    string `form:"time"`
		Talker  string `form:"talker"`
		Sender  string `form:"sender"`
		Keyword string `form:"keyword"`
		Limit   int    `form:"limit"`
		Offset  int    `form:"offset"`
		Format  string `form:"format"`
	}{}

	if err := c.BindQuery(&q); err != nil {
		errors.Err(c, err)
		return
	}

	var err error
	start, end, ok := util.TimeRangeOf(q.Time)
	if !ok {
		errors.Err(c, errors.InvalidArg("time"))
	}
	if q.Limit < 0 {
		q.Limit = 0
	}

	if q.Offset < 0 {
		q.Offset = 0
	}

	messages, err := s.db.GetMessages(start, end, q.Talker, q.Sender, q.Keyword, q.Limit, q.Offset)
	if err != nil {
		errors.Err(c, err)
		return
	}

	switch strings.ToLower(q.Format) {
	case "csv":
	case "json":
		// json
		c.JSON(http.StatusOK, messages)
	default:
		// plain text
		c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Flush()

		for _, m := range messages {
			c.Writer.WriteString(m.PlainText(strings.Contains(q.Talker, ","), util.PerfectTimeFormat(start, end), c.Request.Host))
			c.Writer.WriteString("\n")
			c.Writer.Flush()
		}
	}
}

func (s *Service) GetContacts(c *gin.Context) {

	q := struct {
		Keyword string `form:"keyword"`
		Limit   int    `form:"limit"`
		Offset  int    `form:"offset"`
		Format  string `form:"format"`
	}{}

	if err := c.BindQuery(&q); err != nil {
		errors.Err(c, err)
		return
	}

	list, err := s.db.GetContacts(q.Keyword, q.Limit, q.Offset)
	if err != nil {
		errors.Err(c, err)
		return
	}

	format := strings.ToLower(q.Format)
	switch format {
	case "json":
		// json
		c.JSON(http.StatusOK, list)
	default:
		// csv
		if format == "csv" {
			// 浏览器访问时，会下载文件
			c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
		} else {
			c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		}
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Flush()

		c.Writer.WriteString("UserName,Alias,Remark,NickName\n")
		for _, contact := range list.Items {
			c.Writer.WriteString(fmt.Sprintf("%s,%s,%s,%s\n", contact.UserName, contact.Alias, contact.Remark, contact.NickName))
		}
		c.Writer.Flush()
	}
}

func (s *Service) GetChatRooms(c *gin.Context) {

	q := struct {
		Keyword string `form:"keyword"`
		Limit   int    `form:"limit"`
		Offset  int    `form:"offset"`
		Format  string `form:"format"`
	}{}

	if err := c.BindQuery(&q); err != nil {
		errors.Err(c, err)
		return
	}

	list, err := s.db.GetChatRooms(q.Keyword, q.Limit, q.Offset)
	if err != nil {
		errors.Err(c, err)
		return
	}
	format := strings.ToLower(q.Format)
	switch format {
	case "json":
		// json
		c.JSON(http.StatusOK, list)
	default:
		// csv
		if format == "csv" {
			// 浏览器访问时，会下载文件
			c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
		} else {
			c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		}
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Flush()

		c.Writer.WriteString("Name,Remark,NickName,Owner,UserCount\n")
		for _, chatRoom := range list.Items {
			c.Writer.WriteString(fmt.Sprintf("%s,%s,%s,%s,%d\n", chatRoom.Name, chatRoom.Remark, chatRoom.NickName, chatRoom.Owner, len(chatRoom.Users)))
		}
		c.Writer.Flush()
	}
}

func (s *Service) GetSessions(c *gin.Context) {

	q := struct {
		Keyword string `form:"keyword"`
		Limit   int    `form:"limit"`
		Offset  int    `form:"offset"`
		Format  string `form:"format"`
	}{}

	if err := c.BindQuery(&q); err != nil {
		errors.Err(c, err)
		return
	}

	sessions, err := s.db.GetSessions(q.Keyword, q.Limit, q.Offset)
	if err != nil {
		errors.Err(c, err)
		return
	}
	format := strings.ToLower(q.Format)
	switch format {
	case "csv":
		c.Writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Flush()

		c.Writer.WriteString("UserName,NOrder,NickName,Content,NTime\n")
		for _, session := range sessions.Items {
			c.Writer.WriteString(fmt.Sprintf("%s,%d,%s,%s,%s\n", session.UserName, session.NOrder, session.NickName, strings.ReplaceAll(session.Content, "\n", "\\n"), session.NTime))
		}
		c.Writer.Flush()
	case "json":
		// json
		c.JSON(http.StatusOK, sessions)
	default:
		c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Flush()
		for _, session := range sessions.Items {
			c.Writer.WriteString(session.PlainText(120))
			c.Writer.WriteString("\n")
		}
		c.Writer.Flush()
	}
}

func (s *Service) GetImage(c *gin.Context) {
	s.GetMedia(c, "image")
}

func (s *Service) GetVideo(c *gin.Context) {
	s.GetMedia(c, "video")
}

func (s *Service) GetFile(c *gin.Context) {
	s.GetMedia(c, "file")
}
func (s *Service) GetVoice(c *gin.Context) {
	s.GetMedia(c, "voice")
}

func (s *Service) GetMedia(c *gin.Context, _type string) {
	key := strings.TrimPrefix(c.Param("key"), "/")
	if key == "" {
		errors.Err(c, errors.InvalidArg(key))
		return
	}

	keys := util.Str2List(key, ",")
	if len(keys) == 0 {
		errors.Err(c, errors.InvalidArg(key))
		return
	}

	var _err error
	for _, k := range keys {
		if len(k) != 32 {
			absolutePath := filepath.Join(s.conf.GetDataDir(), k)
			if _, err := os.Stat(absolutePath); os.IsNotExist(err) {
				continue
			}
			c.Redirect(http.StatusFound, "/data/"+k)
			return
		}
		media, err := s.db.GetMedia(_type, k)
		if err != nil {
			_err = err
			continue
		}
		if c.Query("info") != "" {
			c.JSON(http.StatusOK, media)
			return
		}
		switch media.Type {
		case "voice":
			s.HandleVoice(c, media.Data)
			return
		default:
			c.Redirect(http.StatusFound, "/data/"+media.Path)
			return
		}
	}

	if _err != nil {
		errors.Err(c, _err)
		return
	}
}

func (s *Service) GetMediaData(c *gin.Context) {
	relativePath := filepath.Clean(c.Param("path"))

	absolutePath := filepath.Join(s.conf.GetDataDir(), relativePath)

	if _, err := os.Stat(absolutePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "File not found",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(absolutePath))
	switch {
	case ext == ".dat":
		s.HandleDatFile(c, absolutePath)
	default:
		// 直接返回文件
		c.File(absolutePath)
	}

}

func (s *Service) HandleDatFile(c *gin.Context, path string) {

	b, err := os.ReadFile(path)
	if err != nil {
		errors.Err(c, err)
		return
	}
	out, ext, err := dat2img.Dat2Image(b)
	if err != nil {
		c.File(path)
		return
	}

	switch ext {
	case "jpg", "jpeg":
		c.Data(http.StatusOK, "image/jpeg", out)
	case "png":
		c.Data(http.StatusOK, "image/png", out)
	case "gif":
		c.Data(http.StatusOK, "image/gif", out)
	case "bmp":
		c.Data(http.StatusOK, "image/bmp", out)
	case "mp4":
		c.Data(http.StatusOK, "video/mp4", out)
	default:
		c.Data(http.StatusOK, "image/jpg", out)
		// c.File(path)
	}
}

func (s *Service) HandleVoice(c *gin.Context, data []byte) {
	out, err := silk.Silk2MP3(data)
	if err != nil {
		c.Data(http.StatusOK, "audio/silk", data)
		return
	}
	c.Data(http.StatusOK, "audio/mp3", out)
}

// PostSummarize summarizes a single day's chatlog by calling an external API.
// Request JSON: {"date":"YYYY-MM-DD", "talker":"...", "prompt":"..."}
// Response: passthrough of external API response (JSON or text)
func (s *Service) PostSummarize(c *gin.Context) {
    var payload struct {
        Date   string `json:"date"`
        Talker string `json:"talker"`
        Prompt string `json:"prompt"`
    }
    if err := c.ShouldBindJSON(&payload); err != nil {
        errors.Err(c, errors.InvalidArg("date|talker|prompt"))
        return
    }
    if strings.TrimSpace(payload.Date) == "" {
        errors.Err(c, errors.InvalidArg("date"))
        return
    }
    if strings.TrimSpace(payload.Talker) == "" {
        errors.Err(c, errors.InvalidArg("talker"))
        return
    }

    // Parse date into start/end time range (whole day)
    // util.TimeRangeOf supports formats like YYYY-MM-DD and ranges.
    start, end, ok := util.TimeRangeOf(payload.Date)
    if !ok {
        errors.Err(c, errors.InvalidArg("date"))
        return
    }

    // Fetch all messages for that day and talker
    messages, err := s.db.GetMessages(start, end, payload.Talker, "", "", 0, 0)
    if err != nil {
        errors.Err(c, err)
        return
    }

    // Build plain text of the day's chat for message body
    var b strings.Builder
    isGroup := strings.Contains(payload.Talker, ",")
    for _, m := range messages {
        b.WriteString(m.PlainText(isGroup, util.PerfectTimeFormat(start, end), c.Request.Host))
        b.WriteString("\n")
    }
    messageText := b.String()

    // Call external summarize API
    // NOTE: URL currently provided by user; may be configurable later.
    reqBody := map[string]any{
        "prompt":  payload.Prompt,
        "message": messageText,
    }
    bodyBytes, _ := json.Marshal(reqBody)

    httpClient := &http.Client{Timeout: 60 * time.Second}
    req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
        "https://n8n-preview.beqlee.icu/webhook/b2199135-477f-4fab-b45e-dfd21ef1f86b", bytes.NewReader(bodyBytes))
    if err != nil {
        errors.Err(c, err)
        return
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := httpClient.Do(req)
    if err != nil {
        errors.Err(c, err)
        return
    }
    defer resp.Body.Close()

    respBytes, err := io.ReadAll(resp.Body)
    if err != nil {
        errors.Err(c, err)
        return
    }

    // Pass through status and best-effort content type
    ct := resp.Header.Get("Content-Type")
    if ct == "" {
        // Try to detect JSON; else fallback to text
        if json.Valid(respBytes) {
            ct = "application/json; charset=utf-8"
        } else {
            ct = "text/plain; charset=utf-8"
        }
    }
    c.Data(resp.StatusCode, ct, respBytes)
}
