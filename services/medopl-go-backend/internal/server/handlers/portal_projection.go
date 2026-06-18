package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const localWorkspaceID = "workspace-local-rc"
const localTimestamp = "2026-05-24T00:00:00Z"

type localPortalUser struct {
	ID        string
	Name      string
	Email     string
	Role      string
	Status    string
	Balance   float64
	CreatedAt string
}

type localPortalFinanceRow struct {
	ID        string
	UserID    string
	UserName  string
	Type      string
	Amount    float64
	Reason    string
	CreatedAt string
}

type localPortalAnnouncement struct {
	ID        string
	Title     string
	Content   string
	Status    string
	Pinned    bool
	CreatedAt string
	UpdatedAt string
}

type localPortalProjectionState struct {
	mu                  sync.Mutex
	users               []localPortalUser
	financeRows         []localPortalFinanceRow
	announcements       []localPortalAnnouncement
	nextUserSequence    int
	nextFinanceSequence int
	nextAnnouncementSeq int
	stateFile           string
}

type localPortalProjectionSnapshot struct {
	Users               []localPortalUser         `json:"users"`
	FinanceRows         []localPortalFinanceRow   `json:"financeRows"`
	Announcements       []localPortalAnnouncement `json:"announcements"`
	NextUserSequence    int                       `json:"nextUserSequence"`
	NextFinanceSequence int                       `json:"nextFinanceSequence"`
	NextAnnouncementSeq int                       `json:"nextAnnouncementSeq"`
}

var portalProjectionState = newLocalPortalProjectionState()

func newLocalPortalProjectionState() *localPortalProjectionState {
	return newSeededLocalPortalProjectionState("")
}

func NewLocalPortalProjectionState(root string) *localPortalProjectionState {
	state := newSeededLocalPortalProjectionState(root)
	if root == "" {
		return state
	}
	_ = state.load()
	return state
}

func NewLocalPortalProjectionStateChecked(root string) (*localPortalProjectionState, error) {
	state := newSeededLocalPortalProjectionState(root)
	if root == "" {
		return state, nil
	}
	if err := state.load(); err != nil {
		return state, err
	}
	return state, nil
}

func newSeededLocalPortalProjectionState(root string) *localPortalProjectionState {
	stateFile := ""
	if strings.TrimSpace(root) != "" {
		stateFile = filepath.Join(root, "portal-projection-state.json")
	}
	return &localPortalProjectionState{
		users: []localPortalUser{{
			ID:        "user-local-rc",
			Name:      "MedOPL Local User",
			Email:     "local@medopl.test",
			Role:      "admin",
			Status:    "active",
			Balance:   100,
			CreatedAt: localTimestamp,
		}},
		financeRows: []localPortalFinanceRow{{
			ID:        "finance-local-rc",
			UserID:    "user-local-rc",
			UserName:  "MedOPL Local User",
			Type:      "credit",
			Amount:    100,
			Reason:    "local_rc",
			CreatedAt: localTimestamp,
		}},
		announcements: []localPortalAnnouncement{{
			ID:        "announcement-local-rc",
			Title:     "Local RC",
			Content:   "Pre-cloud local RC is active.",
			Status:    "active",
			Pinned:    true,
			CreatedAt: localTimestamp,
			UpdatedAt: localTimestamp,
		}},
		nextUserSequence:    1,
		nextFinanceSequence: 1,
		nextAnnouncementSeq: 1,
		stateFile:           stateFile,
	}
}

func UseLocalPortalProjectionState(state *localPortalProjectionState) func() {
	previous := portalProjectionState
	portalProjectionState = state
	return func() {
		portalProjectionState = previous
	}
}

func (state *localPortalProjectionState) load() error {
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.stateFile == "" {
		return nil
	}
	raw, err := os.ReadFile(state.stateFile)
	if os.IsNotExist(err) {
		return state.persistLocked()
	}
	if err != nil {
		return err
	}
	var snapshot localPortalProjectionSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return err
	}
	if len(snapshot.Users) > 0 {
		state.users = snapshot.Users
	}
	if len(snapshot.FinanceRows) > 0 {
		state.financeRows = snapshot.FinanceRows
	}
	if len(snapshot.Announcements) > 0 {
		state.announcements = snapshot.Announcements
	}
	if snapshot.NextUserSequence > 0 {
		state.nextUserSequence = snapshot.NextUserSequence
	}
	if snapshot.NextFinanceSequence > 0 {
		state.nextFinanceSequence = snapshot.NextFinanceSequence
	}
	if snapshot.NextAnnouncementSeq > 0 {
		state.nextAnnouncementSeq = snapshot.NextAnnouncementSeq
	}
	return nil
}

func (state *localPortalProjectionState) persistLocked() error {
	if state.stateFile == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(state.stateFile), 0o700); err != nil {
		return err
	}
	snapshot := localPortalProjectionSnapshot{
		Users:               state.users,
		FinanceRows:         state.financeRows,
		Announcements:       state.announcements,
		NextUserSequence:    state.nextUserSequence,
		NextFinanceSequence: state.nextFinanceSequence,
		NextAnnouncementSeq: state.nextAnnouncementSeq,
	}
	raw, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(state.stateFile, append(raw, '\n'), 0o600)
}
