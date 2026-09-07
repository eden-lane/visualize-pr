import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { agentInstructions, commentLocation, type CommentTarget, type UserComment } from './comments';
import { review } from './review';

interface CommentsState {
  comments: UserComment[];
  save: (comment: UserComment) => void;
  remove: (id: string) => void;
}
const CommentsContext = createContext<CommentsState | null>(null);
export function useComments() {
  const value = useContext(CommentsContext);
  if (!value) throw new Error('CommentsProvider is required');
  return value;
}

export function CommentsProvider({ children }: { children: ReactNode }) {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [copying, setCopying] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setCopyState('idle'); }, [comments]);
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  const instructions = agentInstructions(review.source, comments);
  return (
    <CommentsContext.Provider value={{
      comments,
      save: (comment) => setComments((current) => current.some((item) => item.id === comment.id)
        ? current.map((item) => item.id === comment.id ? comment : item)
        : [...current, comment]),
      remove: (id) => setComments((current) => current.filter((item) => item.id !== id)),
    }}>
      {children}
      {comments.length > 0 && (
        <div className="comment-export">
          {copyState === 'failed' && (
            <div className="copy-fallback">
              <label htmlFor="agent-instructions">Clipboard unavailable. Copy these instructions manually.</label>
              <textarea id="agent-instructions" ref={fallbackRef} readOnly value={instructions} onFocus={(event) => event.target.select()} />
              <button type="button" onClick={() => setCopyState('idle')}>Close</button>
            </div>
          )}
          <span className="copy-status" role="status">{copyState === 'copied' ? 'Instructions copied' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}</span>
          <button type="button" className="copy-instructions" disabled={copying} onClick={async () => {
            setCopying(true);
            try {
              await navigator.clipboard.writeText(instructions);
              setCopyState('copied');
            } catch {
              setCopyState('failed');
              requestAnimationFrame(() => fallbackRef.current?.focus());
            } finally { setCopying(false); }
          }}>Copy instructions for agent</button>
        </div>
      )}
    </CommentsContext.Provider>
  );
}

export function CommentEditor({ target, initialBody = '', editing = false, onSave, onCancel }: {
  target: CommentTarget;
  initialBody?: string;
  editing?: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  return (
    <form className="user-comment comment-editor" aria-label={editing ? 'Edit comment' : 'Add comment'} onSubmit={(event) => {
      event.preventDefault();
      if (body.trim()) onSave(body.trim());
    }}>
      <label>
        <strong>{editing ? 'Edit comment' : 'Your comment'} · {commentLocation(target)}</strong>
        <textarea autoFocus aria-label="Comment" placeholder="Describe what you want the agent to change…" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (body.trim()) onSave(body.trim()); }
        }} />
      </label>
      <div className="comment-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={!body.trim()}>{editing ? 'Save changes' : 'Add comment'}</button>
      </div>
    </form>
  );
}

export function InlineUserComment({ comment }: { comment: UserComment }) {
  const { save, remove } = useComments();
  const [editing, setEditing] = useState(false);
  return editing ? <CommentEditor target={comment} initialBody={comment.body} editing onCancel={() => setEditing(false)} onSave={(body) => {
    save({ ...comment, body });
    setEditing(false);
  }} /> : (
    <aside className="user-comment" aria-label={`Your comment on ${commentLocation(comment)}`}>
      <div className="user-comment-heading">
        <strong>Your comment · {commentLocation(comment)}</strong>
        <div className="comment-actions">
          <button type="button" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="delete-comment" onClick={() => remove(comment.id)}>Delete</button>
        </div>
      </div>
      <p>{comment.body}</p>
    </aside>
  );
}
