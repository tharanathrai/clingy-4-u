import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Graveyard() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 py-8 text-text">
      <Link to="/home" className="inline-flex items-center gap-2 text-sm text-text-2">
        <ArrowLeft size={18} strokeWidth={1.75} />
        back
      </Link>
      <h1 className="mt-6 font-display text-4xl text-text">graveyard</h1>
      <p className="mt-3 text-sm text-text-2">Plans that didn't happen. Coming soon.</p>
    </main>
  )
}
