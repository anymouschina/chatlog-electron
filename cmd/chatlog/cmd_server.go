package chatlog

import (
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/sjzar/chatlog/internal/chatlog"
)

func init() {
	rootCmd.AddCommand(serverCmd)
	serverCmd.Flags().StringVarP(&serverAddr, "addr", "a", "", "server address")
	serverCmd.Flags().StringVarP(&serverPlatform, "platform", "p", "", "platform")
	serverCmd.Flags().IntVarP(&serverVer, "version", "v", 0, "version")
	serverCmd.Flags().StringVarP(&serverDataDir, "data-dir", "d", "", "data dir")
	serverCmd.Flags().StringVarP(&serverDataKey, "data-key", "k", "", "data key")
	serverCmd.Flags().StringVarP(&serverImgKey, "img-key", "i", "", "img key")
	serverCmd.Flags().StringVarP(&serverWorkDir, "work-dir", "w", "", "work dir")
	serverCmd.Flags().BoolVarP(&serverAutoDecrypt, "auto-decrypt", "", false, "auto decrypt")
}

var (
	serverAddr        string
	serverDataDir     string
	serverDataKey     string
	serverImgKey      string
	serverWorkDir     string
	serverPlatform    string
	serverVer         int
	serverAutoDecrypt bool
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start HTTP server",
	Run: func(cmd *cobra.Command, args []string) {

		cmdConf := getServerConfig()
		log.Info().Msgf("server cmd config: %+v", cmdConf)

		// Auto-acquire dataKey if not provided and auto-decrypt is enabled
		if (cmdConf["data_key"] == nil || cmdConf["data_key"] == "") &&
		   (cmdConf["auto_decrypt"] == true || cmdConf["data_key"] == "default-key-for-initial-setup") {

			log.Info().Msg("No dataKey provided, attempting to auto-acquire...")

			// Try to acquire dataKey
			if dataKey := acquireDataKey(cmdConf); dataKey != "" {
				cmdConf["data_key"] = dataKey
				log.Info().Msgf("Auto-acquired dataKey (length: %d)", len(dataKey))
			} else {
				log.Warn().Msg("Failed to auto-acquire dataKey, server may not function properly")
			}
		}

		m := chatlog.New()
		if err := m.CommandHTTPServer("", cmdConf); err != nil {
			log.Err(err).Msg("failed to start server")
			return
		}
	},
}

func getServerConfig() map[string]any {
	cmdConf := make(map[string]any)
	if len(serverAddr) != 0 {
		cmdConf["http_addr"] = serverAddr
	}
	if len(serverDataDir) != 0 {
		cmdConf["data_dir"] = serverDataDir
	}
	if len(serverDataKey) != 0 {
		cmdConf["data_key"] = serverDataKey
	}
	if len(serverImgKey) != 0 {
		cmdConf["img_key"] = serverImgKey
	}
	if len(serverWorkDir) != 0 {
		cmdConf["work_dir"] = serverWorkDir
	}
	if len(serverPlatform) != 0 {
		cmdConf["platform"] = serverPlatform
	}
	if serverVer != 0 {
		cmdConf["version"] = serverVer
	}
	if serverAutoDecrypt {
		cmdConf["auto_decrypt"] = true
	}
	return cmdConf
}

// acquireDataKey attempts to automatically acquire the dataKey from WeChat process
func acquireDataKey(cmdConf map[string]any) string {
	// Create a temporary manager to extract the key
	m := chatlog.New()

	// Build config for key extraction
	keyConfig := make(map[string]any)
	if serverDataDir != "" {
		keyConfig["data_dir"] = serverDataDir
	}
	if serverPlatform != "" {
		keyConfig["platform"] = serverPlatform
	}
	if serverVer != 0 {
		keyConfig["version"] = serverVer
	}

	// Use the manager's key extraction logic
	result, err := m.CommandKey("", 0, false, false)
	if err != nil {
		log.Err(err).Msg("Failed to acquire dataKey")
		return ""
	}

	// Parse the result to extract just the dataKey
	lines := strings.Split(result, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Data Key: [") {
			key := strings.TrimPrefix(line, "Data Key: [")
			key = strings.TrimSuffix(key, "]")
			if key != "" && key != "[]" {
				return key
			}
		}
	}

	log.Warn().Msg("No dataKey found in extraction result")
	return ""
}
