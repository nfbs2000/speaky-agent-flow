const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function PublicSiteNav() {
  return (
    <nav className="public-site-nav" aria-label="공개 페이지">
      <span>한국어 안내</span>
      <a href={`${basePath}/guide/`}>소스 가이드</a>
      <a href={`${basePath}/education/`}>교육 증거 재생</a>
      <a href="https://github.com/nfbs2000/speaky-agent-flow">GitHub</a>
    </nav>
  )
}
