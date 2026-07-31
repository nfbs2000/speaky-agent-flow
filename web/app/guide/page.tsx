import type { Metadata } from "next"
import "./guide-foundation.css"
import "./guide-sections.css"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const repository = "https://github.com/nfbs2000/speaky-agent-flow"
const upstream = "https://github.com/patoles/agent-flow"

export const metadata: Metadata = {
  title: "Agent Flow 한국어 소스 가이드",
  description: "Claude Code와 Codex 실행을 어떻게 수집하고 공통 이벤트로 시각화하는지 소스 기준으로 설명합니다.",
}

const eventRows = [
  ["에이전트", "agent_spawn, agent_idle, agent_complete", "세션과 서브에이전트의 생명주기"],
  ["대화", "message, context_update, model_detected", "발화, 컨텍스트 사용량, 관측된 모델"],
  ["도구", "tool_call_start, tool_call_end", "도구 입력과 관측된 결과의 왕복"],
  ["위임", "subagent_dispatch, subagent_return", "부모가 자식에게 일을 넘기고 결과를 받는 관계"],
  ["통제", "permission_requested, error", "권한 요청과 실패 신호"],
]

const sourceFiles = [
  ["공통 런타임 계약", "extension/src/session-runtime.ts", "시각화기가 런타임에 요구하는 최소 인터페이스"],
  ["Claude 수집 경계", "extension/src/claude-runtime.ts", "hook과 transcript watcher의 역할 및 중복 억제"],
  ["Claude transcript 해석", "extension/src/transcript-parser.ts", "메시지·도구·서브에이전트 원전을 AgentEvent로 변환"],
  ["Codex 수집 경계", "extension/src/codex-runtime.ts", "rollout watcher 연결과 CODEX_HOME 처리"],
  ["Codex rollout 해석", "extension/src/codex-rollout-parser.ts", "Responses 형태의 record와 token event 해석"],
  ["공통 사건 계약", "extension/src/protocol.ts", "extension과 webview 사이에서 전달되는 AgentEvent"],
  ["상태 투영", "web/hooks/simulation/process-event.ts", "공통 사건을 에이전트·도구·메시지 상태로 분기"],
  ["프레임 루프", "web/hooks/use-agent-simulation.ts", "D3 위치 계산, 재생 시간, 구조적 React 상태 분리"],
  ["캔버스", "web/components/agent-visualizer/canvas", "노드·도구·간선·효과를 그리는 표현 계층"],
  ["교육 증거 변환", "web/lib/education-evidence-adapter.ts", "별도 evidence catalog를 재생 사건으로 투영하는 포크 확장"],
]

function SourceLink({ path, children }: { path: string; children?: React.ReactNode }) {
  return (
    <a href={`${repository}/blob/main/${path}`}>
      {children ?? path}
    </a>
  )
}

export default function GuidePage() {
  return (
    <div className="source-guide" lang="ko">
      <header className="guide-header">
        <div className="guide-header__inner">
          <a className="guide-brand" href={`${basePath}/`}>
            <span className="guide-brand__mark" aria-hidden="true">AF</span>
            <span>Agent Flow 한국어 소스 가이드</span>
          </a>
          <nav aria-label="주요 공개 페이지">
            <a href={`${basePath}/`}>데모</a>
            <a href={`${basePath}/education/`}>교육 증거 재생</a>
            <a href={repository}>소스</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="guide-intro" id="top">
          <div>
            <p className="guide-kicker">SOURCE-GROUNDED RUNTIME VISUALIZATION</p>
            <h1>에이전트가 한 일을<br />사건의 흐름으로 읽는다</h1>
            <p className="guide-lead">
              Agent Flow는 Claude Code와 Codex가 남긴 실행 원전을 감시하고,
              서로 다른 기록을 공통 <code>AgentEvent</code>로 정규화한 뒤
              에이전트·도구·메시지·위임 관계를 캔버스에 투영합니다.
            </p>
            <div className="guide-actions">
              <a className="guide-action guide-action--primary" href={`${basePath}/`}>시각화 데모 열기</a>
              <a className="guide-action" href={`${basePath}/education/`}>기록된 교육 증거 보기</a>
            </div>
          </div>
          <aside className="truth-note" aria-label="가이드의 진실 경계">
            <strong>먼저 구분할 것</strong>
            <dl>
              <div><dt>원전</dt><dd>hook payload, transcript JSONL, rollout JSONL</dd></div>
              <div><dt>정규화</dt><dd>런타임별 parser가 만든 AgentEvent</dd></div>
              <div><dt>투영</dt><dd>D3 상태와 Canvas가 표현한 관계·애니메이션</dd></div>
              <div><dt>공개 데모</dt><dd>실제 세션이 아닌 고정 mock scenario</dd></div>
            </dl>
          </aside>
        </section>

        <div className="guide-layout">
          <aside className="guide-toc">
            <p>읽기 순서</p>
            <a href="#purpose">01 · 무엇을 푸는가</a>
            <a href="#surfaces">02 · 세 실행 표면</a>
            <a href="#pipeline">03 · 전체 파이프라인</a>
            <a href="#claude">04 · Claude Code</a>
            <a href="#codex">05 · Codex</a>
            <a href="#protocol">06 · 공통 사건</a>
            <a href="#renderer">07 · 시각화 해석</a>
            <a href="#evidence">08 · 교육 증거 재생</a>
            <a href="#limits">09 · 말할 수 있는 것</a>
            <a href="#source-map">10 · 소스 지도</a>
            <a href="#run">11 · 실행 방법</a>
          </aside>

          <article className="guide-article">
            <section id="purpose">
              <p className="section-index">01 / PURPOSE</p>
              <h2>무엇을 푸는 프로젝트인가</h2>
              <p>
                터미널의 최종 답만 보면 에이전트가 어떤 파일을 읽었고, 어떤 도구를 호출했으며,
                어디서 자식 에이전트에게 일을 위임했는지 한눈에 알기 어렵습니다. Agent Flow는
                런타임을 대신 실행하거나 판단하지 않습니다. 이미 실행 중인 세션의 기록을 읽어
                작업의 구조를 복원하고, 검토 가능한 시간 흐름으로 보여 줍니다.
              </p>
              <div className="responsibility-grid">
                <div><b>관찰</b><span>세션 파일과 hook 사건을 읽는다</span></div>
                <div><b>번역</b><span>런타임별 원전을 공통 사건으로 바꾼다</span></div>
                <div><b>투영</b><span>에이전트·도구·관계를 화면에 배치한다</span></div>
                <div><b>검토</b><span>타임라인과 transcript로 과정을 되짚는다</span></div>
              </div>
            </section>

            <section id="surfaces">
              <p className="section-index">02 / ENTRY SURFACES</p>
              <h2>하나의 시각화, 세 개의 실행 표면</h2>
              <p>
                제품은 VS Code 확장, 소스 기반 웹 개발 서버, <code>npx agent-flow-app</code>
                standalone 서버로 들어갈 수 있습니다. 입구는 다르지만 런타임 watcher와 사건
                의미는 공유합니다.
              </p>
              <div className="surface-list">
                <div><span>VS CODE</span><b>extension host → webview</b><p>워크스페이스에 붙어 여러 Claude/Codex 세션을 탭으로 표시합니다.</p></div>
                <div><span>DEV WEB</span><b>relay → SSE → Next.js</b><p>로컬 relay가 사건을 브라우저에 전송합니다. UI 개발과 독립 실행에 적합합니다.</p></div>
                <div><span>STANDALONE</span><b>HTTP server + relay + static UI</b><p>패키지 하나로 수집기와 웹 화면을 함께 실행합니다.</p></div>
              </div>
            </section>

            <section id="pipeline">
              <p className="section-index">03 / PIPELINE</p>
              <h2>원전에서 캔버스까지</h2>
              <div className="pipeline" role="img" aria-label="런타임 원전이 공통 이벤트와 시뮬레이션 상태를 거쳐 캔버스로 전달되는 구조">
                <div className="pipeline__sources">
                  <div className="pipeline-node pipeline-node--claude"><small>CLAUDE</small><b>Hook payload</b><span>Transcript JSONL</span></div>
                  <div className="pipeline-node pipeline-node--codex"><small>CODEX</small><b>Rollout JSONL</b><span>turn · response · token</span></div>
                </div>
                <span className="pipeline-arrow" aria-hidden="true">↓ runtime-specific parsing</span>
                <div className="pipeline-node pipeline-node--contract"><small>SHARED CONTRACT</small><b>AgentEvent</b><span>sessionId · time · type · payload</span></div>
                <span className="pipeline-arrow" aria-hidden="true">↓ bridge / SSE</span>
                <div className="pipeline__outputs">
                  <div className="pipeline-node"><small>STATE</small><b>Simulation maps</b><span>agents · tools · messages · edges</span></div>
                  <div className="pipeline-node"><small>VIEW</small><b>D3 + Canvas</b><span>layout · animation · inspection</span></div>
                </div>
              </div>
              <p className="guide-callout">
                공통화 지점은 SDK가 아니라 <strong>시각화에 필요한 사건 계약</strong>입니다.
                Claude와 Codex의 저장 형식·생명주기 차이는 각 parser 안에 남습니다.
              </p>
            </section>

            <section id="claude">
              <p className="section-index">04 / CLAUDE CODE</p>
              <h2>Claude는 두 관찰 경로를 조합한다</h2>
              <p>
                Claude runtime은 낮은 지연의 hook server와 장기 기록인 transcript watcher를 함께
                사용합니다. hook script는 discovery file에서 현재 포트를 읽고 사건을 전달하며,
                watcher는 <code>~/.claude/projects/&lt;project&gt;/&lt;session&gt;.jsonl</code>을
                tail 합니다.
              </p>
              <ol className="numbered-flow">
                <li><b>HookServer</b><span>도구 시작·종료, 권한, 세션과 서브에이전트 hook을 빠르게 받습니다.</span></li>
                <li><b>SessionWatcher</b><span>실제 transcript의 추가분과 subagent 파일을 추적합니다.</span></li>
                <li><b>TranscriptParser</b><span>메시지 block, tool use/result, thinking, inline agent progress를 해석합니다.</span></li>
                <li><b>중복 억제</b><span>watcher가 세션을 소유하면 subagent 생명주기는 transcript 쪽을 우선합니다.</span></li>
              </ol>
              <pre><code>{`// 같은 subagent를 hook과 transcript가 서로 다른 이름으로
// 두 번 그리지 않도록 runtime 경계에서 소유권을 나눈다.
if (watcherHandlesThis && SUBAGENT_LIFECYCLE_EVENTS.has(event.type)) {
  return
}`}</code></pre>
              <p className="source-note">
                소스: <SourceLink path="extension/src/claude-runtime.ts" /> · <SourceLink path="extension/src/transcript-parser.ts" />
              </p>
            </section>

            <section id="codex">
              <p className="section-index">05 / CODEX</p>
              <h2>Codex는 rollout JSONL이 원전이다</h2>
              <p>
                Codex에는 Claude 방식 hook을 꾸며 넣지 않습니다. <code>CODEX_HOME</code> 또는
                <code>~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl</code>을 감시하고,
                워크스페이스가 맞는 세션만 연결합니다.
              </p>
              <div className="record-table" role="table" aria-label="Codex rollout record 해석">
                <div role="row"><b role="cell">session_meta</b><span role="cell">세션 ID, cwd, CLI 버전, 기본 지침</span></div>
                <div role="row"><b role="cell">turn_context</b><span role="cell">현재 turn의 모델, cwd, 승인·sandbox 맥락</span></div>
                <div role="row"><b role="cell">response_item</b><span role="cell">메시지, function/custom tool call과 output</span></div>
                <div role="row"><b role="cell">event_msg</b><span role="cell">task 생명주기, reasoning, 권위 있는 token count</span></div>
                <div role="row"><b role="cell">compacted</b><span role="cell">교체된 대화 history와 compaction 표지</span></div>
              </div>
              <p>
                동일 메시지가 여러 record에 반영될 수 있으므로 parser는 표시 원전을 선택합니다.
                메시지는 <code>response_item.message</code>, reasoning은
                <code>event_msg.agent_reasoning</code>, 도구 결과는 call output을 사용합니다.
              </p>
              <p className="source-note">
                소스: <SourceLink path="extension/src/codex-runtime.ts" /> · <SourceLink path="extension/src/codex-rollout-parser.ts" />
              </p>
            </section>

            <section id="protocol">
              <p className="section-index">06 / NORMALIZED EVENTS</p>
              <h2>공통 사건은 무엇을 보존하는가</h2>
              <p>
                모든 사건은 상대 시간 <code>time</code>, 종류 <code>type</code>, 세부 내용
                <code>payload</code>, 선택적 <code>sessionId</code>를 가집니다. 이 계약 덕분에
                renderer는 원본 SDK를 알지 않아도 같은 시각 언어로 처리할 수 있습니다.
              </p>
              <div className="event-table" role="table" aria-label="AgentEvent 종류">
                {eventRows.map(([domain, events, meaning]) => (
                  <div role="row" key={domain}>
                    <b role="cell">{domain}</b>
                    <code role="cell">{events}</code>
                    <span role="cell">{meaning}</span>
                  </div>
                ))}
              </div>
              <p className="guide-callout guide-callout--amber">
                <code>permission_requested</code>는 권한 요청이 <em>관측되었다</em>는 뜻입니다.
                Agent Flow가 Claude나 Codex의 권한을 승인하는 주체라는 뜻은 아닙니다.
              </p>
            </section>

            <section id="renderer">
              <p className="section-index">07 / PROJECTION</p>
              <h2>그래프는 사건을 읽기 위한 표현이다</h2>
              <p>
                <code>process-event.ts</code>가 사건을 agent, tool, message, subagent handler로
                분배합니다. <code>use-agent-simulation.ts</code>는 구조 상태와 매 프레임 위치를
                나누고, D3 force simulation이 노드 좌표를 갱신합니다. Canvas는 그 상태를
                에이전트 중심, 도구 카드, 부모-자식 간선, particle, context ring으로 그립니다.
              </p>
              <div className="projection-scale">
                <div><small>FACT</small><b>tool_call_start</b><span>관측된 사건</span></div>
                <div><small>STATE</small><b>running tool</b><span>renderer 해석</span></div>
                <div><small>PIXELS</small><b>빛나는 tool card</b><span>화면 표현</span></div>
              </div>
              <p>
                노드 거리, 색, particle, 자동 줌은 이해를 돕는 UI입니다. 런타임의 실제 병렬성,
                인과관계, 숨은 추론을 독립적으로 증명하지는 않습니다. 정확한 검토에는 transcript,
                timeline, 원본 JSONL을 함께 봐야 합니다.
              </p>
            </section>

            <section id="evidence">
              <p className="section-index">08 / EDUCATION REPLAY</p>
              <h2>이 포크의 교육 증거 재생</h2>
              <p>
                <code>/education/</code>은 upstream Agent Flow의 실시간 수집기가 아니라,
                Education Shell에서 이미 기록한 자료를 공개 재생하기 위한 이 포크의 확장입니다.
                빌드 전에 publish script가 선택된 원전에서 공개 catalog를 만들고,
                adapter가 그 catalog를 <code>SimulationEvent</code>로 변환합니다.
              </p>
              <div className="evidence-boundary">
                <div><small>LOCAL SOURCE</small><b>recorded evidence</b><span>경로 · hash · 검증 상태</span></div>
                <span aria-hidden="true">→</span>
                <div><small>PUBLIC CATALOG</small><b>redacted facts</b><span>공개 가능한 사건 집합</span></div>
                <span aria-hidden="true">→</span>
                <div><small>REPLAY</small><b>mapped topology</b><span>그릴 수 있는 사건만 투영</span></div>
              </div>
              <p>
                화면의 <strong>mapped</strong>는 그래프로 바뀐 사건 수이고,
                <strong>facts</strong>는 보존되었지만 그래프에 직접 그리지 않은 사실 수입니다.
                source missing 상태는 성공으로 보정하지 않고 그대로 표시합니다.
              </p>
              <a className="inline-link" href={`${basePath}/education/`}>교육 증거 재생 열기 →</a>
            </section>

            <section id="limits">
              <p className="section-index">09 / TRUTH BOUNDARY</p>
              <h2>이 화면이 말할 수 있는 것과 없는 것</h2>
              <div className="truth-columns">
                <div>
                  <h3>근거가 있는 진술</h3>
                  <ul>
                    <li>특정 세션에서 메시지·도구 사건이 기록되었다.</li>
                    <li>부모가 자식 작업을 dispatch했고 return 사건이 관측되었다.</li>
                    <li>Codex token_count가 있으면 해당 수치를 표시했다.</li>
                    <li>선택한 원전 hash와 공개 catalog의 관계를 확인했다.</li>
                  </ul>
                </div>
                <div>
                  <h3>화면만으로 단정할 수 없는 것</h3>
                  <ul>
                    <li>표시되지 않은 숨은 추론의 정확한 내용</li>
                    <li>그래프 거리나 애니메이션이 실제 실행 시간을 뜻한다는 주장</li>
                    <li>모든 runtime이 동일한 token·context 정보를 제공한다는 주장</li>
                    <li>공개 데모의 mock 사건이 실제 세션 증거라는 주장</li>
                  </ul>
                </div>
              </div>
            </section>

            <section id="source-map">
              <p className="section-index">10 / SOURCE MAP</p>
              <h2>소스를 읽는 가장 짧은 순서</h2>
              <div className="source-map">
                {sourceFiles.map(([label, path, description], index) => (
                  <div key={path}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><b>{label}</b><SourceLink path={path} /></div>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="run">
              <p className="section-index">11 / RUN</p>
              <h2>직접 실행하고 확인하기</h2>
              <div className="run-grid">
                <div>
                  <h3>빠른 실행</h3>
                  <pre><code>{`npx agent-flow-app`}</code></pre>
                  <p>브라우저 UI와 relay를 함께 띄웁니다. 다른 터미널에서 실제 Claude Code 또는 Codex 세션을 시작합니다.</p>
                </div>
                <div>
                  <h3>소스에서 실행</h3>
                  <pre><code>{`pnpm i
pnpm run setup
pnpm run dev`}</code></pre>
                  <p>Next.js와 relay가 함께 실행됩니다. 기본 runtime 모드는 Claude와 Codex를 모두 감시하는 <code>auto</code>입니다.</p>
                </div>
              </div>
              <p>
                하나만 감시하려면 <code>AGENT_FLOW_RUNTIME=claude</code> 또는
                <code>AGENT_FLOW_RUNTIME=codex</code>를 사용합니다. Codex의 설치 위치가
                기본값과 다르면 <code>CODEX_HOME</code>을 지정합니다.
              </p>
            </section>

            <section className="credits" id="credits">
              <p className="section-index">ORIGIN & LICENSE</p>
              <h2>출처와 이 가이드의 위치</h2>
              <p>
                원 프로젝트 <a href={upstream}>Agent Flow</a>는 Simon Patole이 만들었으며
                Apache License 2.0으로 공개되어 있습니다. Agent Flow 이름과 로고는 Simon
                Patole의 상표입니다. 이 페이지는 <a href={repository}>nfbs2000의 공개 포크</a>에
                추가한 한국어 소스 가이드이며, 원 프로젝트의 공식 문서나 보증을 의미하지 않습니다.
              </p>
              <p>
                이 포크가 추가한 교육 evidence replay는 upstream의 기본 기능과 구분해 설명했습니다.
                원 프로젝트의 설치와 최신 기능은 반드시 upstream README와 release를 함께 확인하세요.
              </p>
            </section>
          </article>
        </div>
      </main>

      <footer className="guide-footer">
        <span>Agent Flow 한국어 소스 가이드</span>
        <a href="#top">맨 위로</a>
      </footer>
    </div>
  )
}
