package handlers

import (
	"fmt"
	"strings"
)

func (state *localPortalProjectionState) billingCSV() string {
	state.mu.Lock()
	defer state.mu.Unlock()
	var builder strings.Builder
	builder.WriteString("id,type,amount,reason,created_at\n")
	builder.WriteString("ledger-local-rc-open,hold,10,local_rc_environment_open,2026-05-24T00:00:00Z\n")
	for _, row := range state.financeRows {
		builder.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,%s\n", row.ID, row.Type, row.Amount, row.Reason, row.CreatedAt))
	}
	return builder.String()
}

func actionString(payload map[string]any, key string) string {
	if value, ok := payload[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func actionFloat(payload map[string]any, key string) float64 {
	switch value := payload[key].(type) {
	case float64:
		return value
	case float32:
		return float64(value)
	case int:
		return float64(value)
	case int64:
		return float64(value)
	case string:
		var parsed float64
		_, _ = fmt.Sscanf(strings.TrimSpace(value), "%f", &parsed)
		return parsed
	default:
		return 0
	}
}

func actionBool(payload map[string]any, key string) bool {
	if value, ok := payload[key].(bool); ok {
		return value
	}
	return false
}
