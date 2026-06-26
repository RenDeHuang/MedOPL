package handlers

import (
	"fmt"
	"strings"
)

func (state *localPortalProjectionState) applyAdminAction(action string, payload map[string]any) error {
	state.mu.Lock()
	defer state.mu.Unlock()
	var err error
	switch action {
	case "create-user":
		err = state.createUser(payload)
	case "update-user":
		err = state.updateUser(payload)
	case "toggle-user":
		err = state.toggleUser(payload)
	case "approve-user":
		err = state.approveUser(payload)
	case "delete-user":
		err = state.deleteUser(payload)
	case "recharge":
		err = state.adjustUserBalance(payload, "topup", "admin_recharge")
	case "ledger-adjust":
		actionType := firstNonEmptyString(actionString(payload, "actionType"), "adjustment")
		reason := firstNonEmptyString(actionString(payload, "reason"), "admin_ledger_adjust")
		err = state.adjustUserBalance(payload, actionType, reason)
	case "announcements-save":
		err = state.saveAnnouncement(payload)
	case "announcements-toggle":
		err = state.toggleAnnouncement(payload)
	case "announcements-delete":
		err = state.deleteAnnouncement(payload)
	case "settings", "billing-ops-mark":
		err = nil
	default:
		err = fmt.Errorf("admin_action_not_supported")
	}
	if err != nil {
		return err
	}
	if err := state.persistLocked(); err != nil {
		return fmt.Errorf("admin_state_persist_failed")
	}
	return nil
}

func (state *localPortalProjectionState) createUser(payload map[string]any) error {
	name := actionString(payload, "name")
	email := strings.ToLower(actionString(payload, "email"))
	if name == "" || email == "" {
		return fmt.Errorf("admin_user_name_email_required")
	}
	for _, user := range state.users {
		if strings.EqualFold(user.Email, email) && user.Status != "deleted" {
			return fmt.Errorf("admin_user_duplicate_email")
		}
	}
	userID := fmt.Sprintf("user-local-rc-extra-%d", state.nextUserSequence)
	state.nextUserSequence++
	state.users = append(state.users, localPortalUser{ID: userID, Name: name, Email: email, Role: "user", Status: "active", Balance: 0, CreatedAt: localTimestamp})
	return nil
}

func (state *localPortalProjectionState) updateUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	if name := actionString(payload, "name"); name != "" {
		user.Name = name
	}
	if email := strings.ToLower(actionString(payload, "email")); email != "" {
		user.Email = email
	}
	return nil
}

func (state *localPortalProjectionState) toggleUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	if user.Status == "disabled" {
		user.Status = "active"
	} else {
		user.Status = "disabled"
	}
	return nil
}

func (state *localPortalProjectionState) approveUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	user.Status = "active"
	return nil
}

func (state *localPortalProjectionState) deleteUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	user.Status = "deleted"
	return nil
}

func (state *localPortalProjectionState) adjustUserBalance(payload map[string]any, entryType string, reason string) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	amount := actionFloat(payload, "amount")
	if amount <= 0 {
		return fmt.Errorf("admin_amount_required")
	}
	signedAmount := ledgerSignedAmount(entryType, amount)
	user.Balance += signedAmount
	state.financeRows = append(state.financeRows, localPortalFinanceRow{
		ID:        fmt.Sprintf("finance-local-rc-extra-%d", state.nextFinanceSequence),
		UserID:    user.ID,
		UserName:  user.Name,
		Type:      entryType,
		Amount:    signedAmount,
		Reason:    reason,
		CreatedAt: localTimestamp,
	})
	state.nextFinanceSequence++
	return nil
}

func ledgerSignedAmount(entryType string, amount float64) float64 {
	switch strings.ToLower(strings.TrimSpace(entryType)) {
	case "charge", "debit", "refund", "makeup_charge":
		return -amount
	default:
		return amount
	}
}

func (state *localPortalProjectionState) saveAnnouncement(payload map[string]any) error {
	title := actionString(payload, "title")
	content := actionString(payload, "content")
	if title == "" || content == "" {
		return fmt.Errorf("announcement_title_content_required")
	}
	status := firstNonEmptyString(actionString(payload, "status"), "active")
	pinned := actionBool(payload, "pinned")
	if pinned {
		for index := range state.announcements {
			state.announcements[index].Pinned = false
		}
	}
	if id := actionString(payload, "id"); id != "" {
		for index := range state.announcements {
			if state.announcements[index].ID == id {
				state.announcements[index].Title = title
				state.announcements[index].Content = content
				state.announcements[index].Status = status
				state.announcements[index].Pinned = pinned
				state.announcements[index].UpdatedAt = localTimestamp
				return nil
			}
		}
		return fmt.Errorf("announcement_not_found")
	}
	state.announcements = append(state.announcements, localPortalAnnouncement{
		ID:        fmt.Sprintf("announcement-local-rc-extra-%d", state.nextAnnouncementSeq),
		Title:     title,
		Content:   content,
		Status:    status,
		Pinned:    pinned,
		CreatedAt: localTimestamp,
		UpdatedAt: localTimestamp,
	})
	state.nextAnnouncementSeq++
	return nil
}

func (state *localPortalProjectionState) toggleAnnouncement(payload map[string]any) error {
	announcement := state.findAnnouncement(actionString(payload, "id"))
	if announcement == nil {
		return fmt.Errorf("announcement_not_found")
	}
	switch actionString(payload, "actionType") {
	case "pin":
		for index := range state.announcements {
			state.announcements[index].Pinned = false
		}
		announcement.Pinned = true
	case "deactivate":
		announcement.Status = "inactive"
	case "activate":
		announcement.Status = "active"
	}
	announcement.UpdatedAt = localTimestamp
	return nil
}

func (state *localPortalProjectionState) deleteAnnouncement(payload map[string]any) error {
	announcement := state.findAnnouncement(actionString(payload, "id"))
	if announcement == nil {
		return fmt.Errorf("announcement_not_found")
	}
	announcement.Status = "deleted"
	announcement.Pinned = false
	announcement.UpdatedAt = localTimestamp
	return nil
}

func (state *localPortalProjectionState) findUser(userID string) *localPortalUser {
	for index := range state.users {
		if state.users[index].ID == userID && state.users[index].Status != "deleted" {
			return &state.users[index]
		}
	}
	return nil
}

func (state *localPortalProjectionState) findAnnouncement(id string) *localPortalAnnouncement {
	for index := range state.announcements {
		if state.announcements[index].ID == id && state.announcements[index].Status != "deleted" {
			return &state.announcements[index]
		}
	}
	return nil
}
