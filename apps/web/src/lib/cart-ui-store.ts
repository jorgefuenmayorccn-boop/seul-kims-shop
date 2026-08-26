import { create } from 'zustand'

interface CartUIState {
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

export const useCartUIStore = create<CartUIState>()(set => ({
  drawerOpen: false,
  openDrawer:  () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set(s => ({ drawerOpen: !s.drawerOpen })),
}))
