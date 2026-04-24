import LibraryClient from '@/components/library/LibraryClient'

interface Props {
  searchParams: Promise<{ synced?: string; anonymous_id?: string }>
}

export default async function LibraryPage({ searchParams }: Props) {
  const { synced, anonymous_id } = await searchParams
  return (
    <LibraryClient
      justSynced={synced === '1'}
      fallbackAnonymousId={anonymous_id ?? null}
    />
  )
}
