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
    enterExportMode?: () => Promise<void>
    exitExportMode?: () => void
  },
): Promise<() => void> {
  const snapshot: GraphSnapshotSelectionState = {
    selectedUserId: state.selectedUserId,
    selectedBridge: state.selectedBridge,
    selectedUser: state.selectedUser,
  }

  await actions.enterExportMode?.()

  if (snapshot.selectedUserId || snapshot.selectedBridge) {
    actions.clearSelection()
    await actions.waitForPaint()
  } else {
    await actions.waitForPaint()
  }

  return () => {
    actions.exitExportMode?.()
    if (snapshot.selectedUserId || snapshot.selectedBridge) {
      actions.restoreSelection(snapshot)
    }
  }
}
