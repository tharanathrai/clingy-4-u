import type { Bridge, User } from '../types/index.ts'

export type GraphSnapshotSelectionState = {
  selectedUserId: string | null
  selectedBridge: Bridge | null
  selectedUser: User | null
}

export async function prepareGraphSnapshotCapture(
  state: GraphSnapshotSelectionState,
  actions: {
    clearSelection: () => void
    restoreSelection: (state: GraphSnapshotSelectionState) => void
    waitForPaint: () => Promise<void>
  },
): Promise<() => void> {
  const snapshot: GraphSnapshotSelectionState = {
    selectedUserId: state.selectedUserId,
    selectedBridge: state.selectedBridge,
    selectedUser: state.selectedUser,
  }

  if (!snapshot.selectedUserId && !snapshot.selectedBridge) {
    return () => {}
  }

  actions.clearSelection()
  await actions.waitForPaint()

  return () => {
    actions.restoreSelection(snapshot)
  }
}
