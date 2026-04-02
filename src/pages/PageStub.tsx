interface PageStubProps {
  title: string
}

export function PageStub({ title }: PageStubProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10 text-center">
      <h1 className="font-display text-4xl text-text">{title}</h1>
    </main>
  )
}
