// B2C Home — Fase 3
// Por ahora redirige al cerebro durante el desarrollo
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/cerebro/dashboard')
}
