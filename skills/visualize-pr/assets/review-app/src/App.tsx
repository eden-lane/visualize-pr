import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { parsePatchFiles, type DiffLineAnnotation, type FileDiffOptions, type SelectedLineRange } from '@pierre/diffs';
import { PatchDiff } from '@pierre/diffs/react';
import {
  themeToTreeStyles,
  type FileTreeRowDecorationRenderer,
} from '@pierre/trees';
import {
  FileTree,
  useFileTree,
  useFileTreeSelection,
} from '@pierre/trees/react';
import { review } from './review';
import { CommentEditor, CommentsProvider, InlineUserComment, useComments } from './ReviewComments';
import { commentTarget, type CommentTarget, type UserComment } from './comments';
import { scrollbarStyles } from './scrollbars';
import type {
  FileStatus,
  ReviewAnnotation,
  ReviewChange,
  ReviewPart,
  WhyConfidence,
} from './types';

const orderedParts = [...review.parts].sort((left, right) => left.order - right.order);
const partFromHash = () => orderedParts.find((part) => window.location.hash === `#part-${part.id}`)?.id ?? orderedParts[0].id;

type DiffStyle = 'unified' | 'split';
type Theme = 'light' | 'dark';
type ReviewAnnotationMetadata = Omit<ReviewAnnotation, 'side' | 'lineNumber'>;
type InlineMetadata = ReviewAnnotationMetadata | { type: 'user'; comment: UserComment } | { type: 'draft'; target: CommentTarget };

const fileTreeDecorationStyles = `
  [data-item-section="decoration"] > span:not(:empty) {
    gap: 4px;
    color: var(--trees-review-note-color, var(--trees-fg-muted));
    font-variant-numeric: tabular-nums;
    font-weight: var(--trees-font-weight-semibold);
  }

  [data-item-section="decoration"] > span:not(:empty)::before {
    content: '';
    width: 13px;
    height: 13px;
    flex: none;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='currentColor' d='M8 1.25a4.75 4.75 0 0 0-2.92 8.5c.44.35.67.76.67 1.18v.32h4.5v-.32c0-.42.23-.83.67-1.18A4.75 4.75 0 0 0 8 1.25Zm2 11.25H6v1h4v-1Zm-.75 2H6.75a1.25 1.25 0 0 0 2.5 0Z'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='currentColor' d='M8 1.25a4.75 4.75 0 0 0-2.92 8.5c.44.35.67.76.67 1.18v.32h4.5v-.32c0-.42.23-.83.67-1.18A4.75 4.75 0 0 0 8 1.25Zm2 11.25H6v1h4v-1Zm-.75 2H6.75a1.25 1.25 0 0 0 2.5 0Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }
`;

function BranchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon">
      <circle cx="6" cy="5" r="2" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="6" cy="15" r="2" />
      <path d="M6 7v6M8 11h2a4 4 0 0 0 4-4" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === 'light' ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon">
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.35 4.35l1.4 1.4M14.25 14.25l1.4 1.4M15.65 4.35l-1.4 1.4M5.75 14.25l-1.4 1.4" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon">
      <path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="review-note-nav-icon">
      <path d="M8 1.25a4.75 4.75 0 0 0-2.92 8.5c.44.35.67.76.67 1.18v.32h4.5v-.32c0-.42.23-.83.67-1.18A4.75 4.75 0 0 0 8 1.25Zm2 11.25H6v1h4v-1Zm-.75 2H6.75a1.25 1.25 0 0 0 2.5 0Z" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="review-note-nav-icon">
      <path d={direction === 'left' ? 'm9.75 3.5-4.5 4.5 4.5 4.5' : 'm6.25 3.5 4.5 4.5-4.5 4.5'} />
    </svg>
  );
}

function statusLabel(status: FileStatus) {
  return {
    added: 'Added',
    modified: 'Modified',
    deleted: 'Deleted',
    renamed: 'Renamed',
  }[status];
}

function Confidence({ value }: { value: WhyConfidence }) {
  const label = {
    confirmed: 'Confirmed rationale',
    inferred: 'Inferred rationale',
    unknown: 'Rationale not established',
  }[value];
  return <span className={`confidence confidence-${value}`}>{label}</span>;
}

function PartFileTree({
  changes,
  selectedPath,
  theme,
  onSelect,
}: {
  changes: ReviewChange[];
  selectedPath: string;
  theme: Theme;
  onSelect: (path: string) => void;
}) {
  const paths = useMemo(() => changes.map((change) => change.path), [changes]);
  const pathSet = useMemo(() => new Set(paths), [paths]);
  const gitStatus = useMemo(
    () => changes.map(({ path, status }) => ({ path, status })),
    [changes],
  );
  const annotationCounts = useMemo(
    () => new Map(
      changes
        .filter((change) => change.annotations?.length)
        .map((change) => [change.path, change.annotations!.length]),
    ),
    [changes],
  );
  const renderRowDecoration = useMemo<FileTreeRowDecorationRenderer>(
    () => ({ item }) => {
      if (item.kind !== 'file') return null;
      const count = annotationCounts.get(item.path);
      if (!count) return null;
      return {
        text: String(count),
        title: `${count} inline review ${count === 1 ? 'comment' : 'comments'}`,
      };
    },
    [annotationCounts],
  );
  const { model } = useFileTree({
    paths,
    gitStatus,
    icons: 'standard',
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    renderRowDecoration,
    search: false,
    unsafeCSS: fileTreeDecorationStyles + scrollbarStyles,
  });
  const selectedPaths = useFileTreeSelection(model);
  const treeTheme = useMemo(() => {
    const dark = theme === 'dark';
    return themeToTreeStyles({
      name: `part-${theme}`,
      type: theme,
      bg: 'transparent',
      fg: dark ? '#c7c9cf' : '#33363d',
      colors: {
        'editor.background': 'transparent',
        'editor.foreground': dark ? '#c7c9cf' : '#33363d',
        'sideBar.background': 'transparent',
        'sideBar.foreground': dark ? '#c7c9cf' : '#33363d',
        'list.hoverBackground': dark ? '#17181b' : '#f3f3f1',
        'list.activeSelectionBackground': dark ? '#1d1f22' : '#ececea',
        'list.activeSelectionForeground': dark ? '#f4f4f5' : '#171719',
        'focusBorder': dark ? '#777b84' : '#7b7f87',
        'gitDecoration.modifiedResourceForeground': dark ? '#d1a85a' : '#986f1b',
        'gitDecoration.addedResourceForeground': dark ? '#52b267' : '#24813a',
        'gitDecoration.deletedResourceForeground': dark ? '#dc6666' : '#bd3b3b',
      },
    });
  }, [theme]);

  useEffect(() => {
    const nextPath = [...selectedPaths].reverse().find((path) => pathSet.has(path));
    if (nextPath && nextPath !== selectedPath) onSelect(nextPath);
  }, [onSelect, pathSet, selectedPath, selectedPaths]);

  useEffect(() => {
    if (!selectedPath || model.getSelectedPaths().includes(selectedPath)) return;
    for (const path of model.getSelectedPaths()) model.getItem(path)?.deselect();
    model.getItem(selectedPath)?.select();
    model.scrollToPath(selectedPath, { offset: 'nearest', focus: false });
  }, [model, selectedPath]);

  const selectedChange = changes.find((change) => change.path === selectedPath);
  const file = review.files.find((item) => item.path === selectedPath);

  return (
    <div className="part-files" aria-label="Files in this logical part">
      <div className="part-files-heading">
        <span>Files in this part</span>
        <span>{changes.length}</span>
      </div>
      <FileTree
        model={model}
        className="part-file-tree"
        style={{
          ...treeTheme,
          height: '100%',
          '--trees-selected-bg-override': 'var(--selection)',
          '--trees-border-color-override': 'var(--line)',
          '--trees-fg-override': 'var(--ink)',
          '--trees-review-note-color': theme === 'dark' ? '#d1a85a' : '#986f1b',
        } as React.CSSProperties}
      />
      {selectedChange ? (
        <div className="selected-file-meta" aria-live="polite">
          <span className="selected-file-labels">
            <span className={`status status-${selectedChange.status}`}>
              {statusLabel(selectedChange.status)}
            </span>
            {selectedChange.annotations?.length ? (
              <span className="annotation-count">
                {selectedChange.annotations.length}{' '}
                {selectedChange.annotations.length === 1 ? 'review note' : 'review notes'}
              </span>
            ) : null}
          </span>
          {file ? (
            <span className="file-delta">
              <span className="addition">+{file.additions}</span>
              <span className="deletion">−{file.deletions}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InlineReviewNote({
  annotation,
  active,
  position,
  total,
  registerElement,
}: {
  annotation: DiffLineAnnotation<ReviewAnnotationMetadata>;
  active: boolean;
  position: number;
  total: number;
  registerElement: (id: string, element: HTMLElement | null) => void;
}) {
  const note = annotation.metadata;
  return (
    <aside
      ref={(element) => registerElement(note.id, element)}
      className={`inline-review-note note-${note.kind}${active ? ' is-active' : ''}`}
      aria-label={`Review note ${position} of ${total}`}
      data-review-note-id={note.id}
    >
      <div className="review-note-rail" aria-hidden="true">
        <span>{note.kind}</span>
      </div>
      <div className="review-note-copy">
        <div className="review-note-heading">
          <strong>{note.title}</strong>
          <Confidence value={note.confidence} />
        </div>
        <p>{note.body}</p>
      </div>
    </aside>
  );
}

function ChangeDiff({
  change,
  options,
  scrollContainerRef,
}: {
  change: ReviewChange;
  options: FileDiffOptions<InlineMetadata>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const annotations = useMemo(() => change.annotations ?? [], [change.annotations]);
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState(0);
  const annotationElements = useRef(new Map<string, HTMLElement>());
  const { comments, save } = useComments();
  const [selection, setSelection] = useState<SelectedLineRange | null>(null);
  const [draft, setDraft] = useState<CommentTarget | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const oldPath = useMemo(() => change.patch ? parsePatchFiles(change.patch)[0]?.files[0]?.prevName : undefined, [change.patch]);
  const openComment = useCallback((range: SelectedLineRange | null) => {
    setSelection(range);
    const target = range ? commentTarget(range) : null;
    setSelectionError(range && !target ? 'Select lines on one side of the diff at a time (Old or New).' : '');
    setDraft(target);
  }, []);
  const closeDraft = () => { setDraft(null); setSelection(null); };
  const commentOptions = useMemo<FileDiffOptions<InlineMetadata>>(() => ({
    ...options,
    enableLineSelection: true,
    enableGutterUtility: true,
    onLineSelectionEnd: openComment,
    onGutterUtilityClick: openComment,
  }), [options, openComment]);
  const lineAnnotations = useMemo<DiffLineAnnotation<InlineMetadata>[]>(
    () => [
      ...annotations.map(({ side, lineNumber, ...metadata }) => ({ side, lineNumber, metadata })),
      ...comments.filter((comment) => comment.changeId === change.id).map((comment) => ({
        side: comment.side, lineNumber: comment.end, metadata: { type: 'user' as const, comment },
      })),
      ...(draft ? [{ side: draft.side, lineNumber: draft.end, metadata: { type: 'draft' as const, target: draft } }] : []),
    ],
    [annotations, comments, change.id, draft],
  );
  const registerAnnotationElement = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) annotationElements.current.set(id, element);
      else annotationElements.current.delete(id);
    },
    [],
  );
  const showAnnotation = useCallback((index: number) => {
    if (!annotations.length) return;
    const nextIndex = (index + annotations.length) % annotations.length;
    setActiveAnnotationIndex(nextIndex);

    const scrollToTarget = () => {
      const target = annotationElements.current.get(annotations[nextIndex].id);
      const container = scrollContainerRef.current;
      if (!target || !container) return;
      const header = container.querySelector<HTMLElement>('.change-heading');
      const targetTop = container.scrollTop
        + target.getBoundingClientRect().top
        - container.getBoundingClientRect().top
        - (header?.offsetHeight ?? 0)
        - 12;
      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    };

    if (annotationElements.current.has(annotations[nextIndex].id)) scrollToTarget();
    else requestAnimationFrame(scrollToTarget);
  }, [annotations, scrollContainerRef]);

  return (
    <article className="change-block">
      <div className="change-heading">
        <strong>{change.path}</strong>
        <div className="change-heading-actions">
          {annotations.length ? (
            <div className="review-note-nav" role="group" aria-label="Inline comment navigation">
              <button
                type="button"
                aria-label="Previous inline comment"
                title="Previous inline comment"
                disabled={annotations.length < 2}
                onClick={() => showAnnotation(activeAnnotationIndex - 1)}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="review-note-progress" aria-live="polite">
                <BulbIcon />
                <span>{activeAnnotationIndex + 1} / {annotations.length}</span>
              </span>
              <button
                type="button"
                aria-label="Next inline comment"
                title="Next inline comment"
                disabled={annotations.length < 2}
                onClick={() => showAnnotation(activeAnnotationIndex + 1)}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
          ) : null}
          <span className={`status status-${change.status}`}>
            {statusLabel(change.status)}
          </span>
        </div>
      </div>
      {change.patch && <p className="comment-hint">Click a line number to comment. Drag or Shift-click for a range. Comments stay available while this review is open.</p>}
      {selectionError && <p className="comment-selection-error" role="alert">{selectionError}</p>}
      {change.patch ? (
        <PatchDiff
          patch={change.patch}
          options={commentOptions}
          selectedLines={selection}
          lineAnnotations={lineAnnotations}
          renderAnnotation={(annotation) => {
            const metadata = annotation.metadata;
            if ('type' in metadata) {
              if (metadata.type === 'user') return <InlineUserComment key={metadata.comment.id} comment={metadata.comment} />;
              return <CommentEditor key="draft" target={metadata.target} onCancel={closeDraft} onSave={(body) => {
                save({ id: crypto.randomUUID(), changeId: change.id, path: change.path, oldPath, ...metadata.target, body });
                closeDraft();
              }} />;
            }
            const index = annotations.findIndex(
              (item) => item.id === metadata.id,
            );
            return (
              <InlineReviewNote
                annotation={{ ...annotation, metadata }}
                active={index === activeAnnotationIndex}
                position={index + 1}
                total={annotations.length}
                registerElement={registerAnnotationElement}
              />
            );
          }}
        />
      ) : (
        <div className="unrenderable-note">
          <strong>Text diff unavailable</strong>
          <p>{change.note}</p>
        </div>
      )}
    </article>
  );
}

function PartSection({
  part,
  total,
  theme,
  options,
  selectedPath,
  onSelect,
}: {
  part: ReviewPart;
  total: number;
  theme: Theme;
  options: FileDiffOptions<InlineMetadata>;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const diffStageRef = useRef<HTMLDivElement>(null);
  const selectedChange = part.changes.find((change) => change.path === selectedPath)
    ?? part.changes[0];

  return (
    <section id={`part-${part.id}`} className="part-section" role="tabpanel" aria-labelledby={`tab-${part.id}`} tabIndex={0}>
      <div className="part-story">
        <div className="part-kicker">
          {String(part.order).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
        <h2>{part.title}</h2>
        <p className="part-summary">{part.summary}</p>

        <div className="part-explanation">
          <div>
            <h3>What changed</h3>
            <p>{part.whatChanged}</p>
          </div>
          <div>
            <div className="explanation-label">
              <h3>Why this shape</h3>
              <Confidence value={part.whyConfidence} />
            </div>
            <p>{part.whyThisApproach}</p>
          </div>
        </div>

        <details className="review-notes">
          <summary>Review focus and evidence</summary>
          <div className="review-notes-content">
            <div>
              <strong>Questions to answer</strong>
              <ul>
                {part.reviewFocus.map((question) => <li key={question}>{question}</li>)}
              </ul>
            </div>
            <div>
              <strong>Evidence</strong>
              <ul>
                {part.evidence.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <strong>Depends on</strong>
              {part.dependsOn.length ? (
                <ul>
                  {part.dependsOn.map((id) => {
                    const dependency = orderedParts.find((item) => item.id === id);
                    return <li key={id}>{dependency?.title ?? id}</li>;
                  })}
                </ul>
              ) : <p>Nothing earlier in this PR.</p>}
            </div>
          </div>
        </details>
      </div>

      <div className="part-editor" aria-label="Change set editor">
        <PartFileTree
          changes={part.changes}
          selectedPath={selectedChange?.path ?? ''}
          theme={theme}
          onSelect={onSelect}
        />
        <div ref={diffStageRef} className="part-diff-stage">
          {selectedChange ? (
            <ChangeDiff
              key={selectedChange.path}
              change={selectedChange}
              options={options}
              scrollContainerRef={diffStageRef}
            />
          ) : (
            <div className="empty-diff">No textual change is assigned to this part.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export function App() {
  return <CommentsProvider><ReviewApp /></CommentsProvider>;
}

function ReviewApp() {
  const [activePartId, setActivePartId] = useState(partFromHash);
  const activePart = orderedParts.find((part) => part.id === activePartId) ?? orderedParts[0];
  const [selectedPaths, setSelectedPaths] = useState<Record<string, string>>({});
  const tabStripRef = useRef<HTMLElement>(null);
  const [hiddenTabs, setHiddenTabs] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const updateEdges = () => {
      const left = strip.scrollLeft > 1;
      const right = strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 1;
      setHiddenTabs((previous) => previous.left === left && previous.right === right
        ? previous : { left, right });
    };
    const observer = new ResizeObserver(updateEdges);
    observer.observe(strip);
    for (const tab of strip.children) observer.observe(tab);
    strip.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    return () => {
      observer.disconnect();
      strip.removeEventListener('scroll', updateEdges);
    };
  }, []);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectPart = (id: string) => {
    setActivePartId(id);
    if (window.location.hash !== `#part-${id}`) window.history.pushState(null, '', `#part-${id}`);
  };
  useLayoutEffect(() => {
    // Scroll only the tab strip; changing a tab must not move the page.
    const tab = tabRefs.current.get(activePart.id);
    const strip = tab?.parentElement;
    if (!tab || !strip) return;
    const tabBounds = tab.getBoundingClientRect();
    const stripBounds = strip.getBoundingClientRect();
    if (tabBounds.left < stripBounds.left) strip.scrollLeft += tabBounds.left - stripBounds.left;
    else if (tabBounds.right > stripBounds.right) strip.scrollLeft += tabBounds.right - stripBounds.right;
  }, [activePart.id]);
  useEffect(() => {
    const syncPart = () => setActivePartId(partFromHash());
    window.addEventListener('hashchange', syncPart);
    return () => window.removeEventListener('hashchange', syncPart);
  }, []);
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('unified');
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [themeOverride, setThemeOverride] = useState<Theme | null>(null);
  const theme = themeOverride ?? systemTheme;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => setSystemTheme(preference.matches ? 'dark' : 'light');
    preference.addEventListener('change', syncTheme);
    syncTheme();
    return () => preference.removeEventListener('change', syncTheme);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const diffOptions = useMemo<FileDiffOptions<InlineMetadata>>(() => ({
    theme: { dark: 'ayu-dark', light: 'ayu-light' },
    themeType: theme,
    diffStyle,
    diffIndicators: 'classic',
    disableBackground: false,
    hunkSeparators: 'metadata',
    overflow: 'scroll',
    lineDiffType: 'word-alt',
    unsafeCSS: scrollbarStyles,
  }), [diffStyle, theme]);

  return (
    <div className="app-shell">
      <style>{scrollbarStyles}</style>
      <header className="topbar">
        <a className="repository" href={review.source.url} target="_blank" rel="noreferrer">
          <span className="repository-mark" aria-hidden="true">R</span>
          <span>{review.source.repository}</span>
        </a>
        <div className="topbar-actions">
          <span className="branch"><BranchIcon />{review.source.baseRef}<ArrowIcon />{review.source.headRef}</span>
          <div className="segmented-control" aria-label="Diff layout">
            <button
              type="button"
              aria-pressed={diffStyle === 'unified'}
              onClick={() => setDiffStyle('unified')}
            >
              Unified
            </button>
            <button
              type="button"
              aria-pressed={diffStyle === 'split'}
              onClick={() => setDiffStyle('split')}
            >
              Split
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={() => setThemeOverride(theme === 'light' ? 'dark' : 'light')}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </header>

      <main className="review-main">
        <section className="pr-intro">
          <div className="pr-title-row">
            <div>
              <h1>{review.pr.title}</h1>
              <p className="pr-meta">
                {review.pr.author} · {review.source.repository}#{review.source.number} ·{' '}
                {review.source.baseRef} ← {review.source.headRef}
              </p>
            </div>
            <a href={review.source.url} target="_blank" rel="noreferrer" className="source-link">
              Open PR <ArrowIcon />
            </a>
          </div>
          <details className="pr-context">
            <summary>Review overview</summary>
            <div className="review-overview">
              <p>{review.pr.description}</p>
              <p>{review.summary.overview}</p>
              <p><strong>Review order:</strong> {review.summary.reviewStrategy}</p>
              <p><strong>Main risk:</strong> {review.summary.risk}</p>
            </div>
          </details>
        </section>

        <div className="review-map-frame" data-hidden-left={hiddenTabs.left} data-hidden-right={hiddenTabs.right}>
        <nav ref={tabStripRef} className="review-map" role="tablist" aria-label="Logical change sets">
          {orderedParts.map((part, index) => (
            <button
              key={part.id}
              ref={(element) => { if (element) tabRefs.current.set(part.id, element); else tabRefs.current.delete(part.id); }}
              id={`tab-${part.id}`}
              type="button"
              role="tab"
              aria-selected={activePart.id === part.id}
              aria-controls={`part-${part.id}`}
              tabIndex={activePart.id === part.id ? 0 : -1}
              onClick={() => selectPart(part.id)}
              onKeyDown={(event) => {
                const next = event.key === 'ArrowRight' ? (index + 1) % orderedParts.length
                  : event.key === 'ArrowLeft' ? (index - 1 + orderedParts.length) % orderedParts.length
                  : event.key === 'Home' ? 0
                  : event.key === 'End' ? orderedParts.length - 1 : null;
                if (next === null) return;
                event.preventDefault();
                selectPart(orderedParts[next].id);
                tabRefs.current.get(orderedParts[next].id)?.focus();
              }}
            >
              <span>{String(part.order).padStart(2, '0')}</span>
              {part.title}
              <span className="tab-file-count">{part.changes.length}</span>
            </button>
          ))}
        </nav>
        </div>

        <div className="parts-list">
            <PartSection
              key={activePart.id}
              part={activePart}
              total={orderedParts.length}
              theme={theme}
              options={diffOptions}
              selectedPath={selectedPaths[activePart.id] ?? activePart.changes.find((change) => change.annotations?.length)?.path ?? activePart.changes[0]?.path ?? ''}
              onSelect={(path) => setSelectedPaths((paths) => ({ ...paths, [activePart.id]: path }))}
            />
        </div>

        <footer>
          Generated from {review.source.headCommit.slice(0, 8)} on{' '}
          {new Date(review.generatedAt).toLocaleString()} · This map explains the change; it does not approve it. <a href="/licenses.txt" target="_blank" rel="noreferrer">Licenses</a>
        </footer>
      </main>
    </div>
  );
}
