"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Camera, Check, FileText, Globe, Mail, MessageCircle, Mic, Pencil, PhoneCall, RefreshCw, Square, StickyNote, Trash2, Upload, Users, X } from "lucide-react";
import { ACTIVITY_LABEL } from "@/lib/constants";
import { cn, formatDateTime, relativeTime } from "@/lib/format";
import { api } from "@/lib/client";
import type { ActivityItem, NoteItem, PhotoItem, RecordingItem } from "@/lib/types";
import { useToast } from "../ui/toast";
import { EmptyState } from "../ui/primitives";

const TYPE_ICON: Record<string, typeof PhoneCall> = {
  CALL: PhoneCall,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  VISIT: Users,
  NOTE: StickyNote,
  STATUS: RefreshCw,
  FOLLOWUP: CalendarClock,
  SYSTEM: FileText,
  ENRICH: Globe,
};

export function Timeline({ items, onDelete }: { items: ActivityItem[]; onDelete: (id: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!items.length) return <EmptyState title="No activity yet">Calls, messages, status changes and notes will build up here.</EmptyState>;
  return (
    <ol className="relative space-y-1">
      {items.map((a) => {
        const Icon = TYPE_ICON[a.type] ?? FileText;
        const expanded = openId === a.id;
        const duration = typeof a.meta.durationSec === "number" && a.meta.durationSec > 0 ? ` · ${Math.floor((a.meta.durationSec as number) / 60)}m ${(a.meta.durationSec as number) % 60}s` : "";
        return (
          <li key={a.id} className="group rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <div className="flex items-start gap-2.5">
              <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", a.type === "STATUS" ? "bg-violet-soft text-violet-ink" : a.type === "SYSTEM" || a.type === "ENRICH" ? "bg-surface-3 text-muted" : "bg-accent-soft text-accent-ink")}>
                <Icon size={13} />
              </span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(expanded ? null : a.id)} aria-expanded={expanded}>
                <span className="block text-[12.5px] font-medium leading-snug">{a.summary || ACTIVITY_LABEL[a.type]}</span>
                <span className="block text-[11.5px] text-muted" title={formatDateTime(a.occurredAt)}>
                  {ACTIVITY_LABEL[a.type] ?? a.type}
                  {a.outcome && !a.summary.includes(a.outcome) ? ` · ${a.outcome}` : ""}
                  {duration} · {relativeTime(a.occurredAt)}
                </span>
                {a.details && !expanded ? <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-2">{a.details}</span> : null}
              </button>
              {a.type !== "SYSTEM" ? (
                <button
                  className="btn btn-ghost btn-sm invisible h-6 px-1 text-muted group-hover:visible"
                  title="Delete this entry"
                  onClick={() => {
                    if (confirm("Delete this timeline entry?")) onDelete(a.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
            {expanded && a.details ? <pre className="mt-1.5 ml-8 whitespace-pre-wrap rounded-md bg-surface-2 p-2 font-sans text-[12px] text-ink-2">{a.details}</pre> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Notes({ businessId, notes, setNotes }: { businessId: string; notes: NoteItem[]; setNotes: (n: NoteItem[]) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("General");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const add = async () => {
    if (!text.trim()) return;
    try {
      const n = await api<NoteItem>(`/api/businesses/${businessId}/notes`, { body: { content: text, kind } });
      setNotes([n, ...notes]);
      setText("");
      toast("Note saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save note", "error");
    }
  };
  const saveEdit = async (id: string) => {
    try {
      const n = await api<NoteItem>(`/api/notes/${id}`, { method: "PATCH", body: { content: editText } });
      setNotes(notes.map((x) => (x.id === id ? n : x)));
      setEditing(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await api(`/api/notes/${id}`, { method: "DELETE" });
    setNotes(notes.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea
          className="textarea"
          placeholder="Add a note - call notes, meeting notes, anything to remember…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
          aria-label="New note"
        />
        <div className="flex items-center gap-2">
          <select className="select w-[130px]" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Note type">
            <option>General</option>
            <option>Call</option>
            <option>Meeting</option>
            <option>Research</option>
          </select>
          <button className="btn btn-primary btn-sm ml-auto" onClick={add} disabled={!text.trim()}>
            Add note <span className="kbd ml-1 border-white/30 bg-white/15 text-white">⌘↵</span>
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="group rounded-lg border border-line p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px] text-muted">
              <span>
                <span className="badge mr-1.5">{n.kind}</span>
                {formatDateTime(n.createdAt)}
              </span>
              <span className="invisible flex gap-0.5 group-hover:visible">
                <button className="btn btn-ghost btn-sm h-6 px-1" onClick={() => (setEditing(n.id), setEditText(n.content))} title="Edit">
                  <Pencil size={12} />
                </button>
                <button className="btn btn-ghost btn-sm h-6 px-1" onClick={() => remove(n.id)} title="Delete">
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            {editing === n.id ? (
              <div className="space-y-1.5">
                <textarea className="textarea" value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="flex justify-end gap-1.5">
                  <button className="btn btn-sm" onClick={() => setEditing(null)}>
                    <X size={12} /> Cancel
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => saveEdit(n.id)}>
                    <Check size={12} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{n.content}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** Voice notes / conversation recordings, stored only on this Mac. */
export function Recorder({ businessId, recordings, setRecordings, onSaved }: { businessId: string; recordings: RecordingItem[]; setRecordings: (r: RecordingItem[]) => void; onSaved?: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "recording" | "review" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const preview = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );

  const start = async () => {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      toast("This browser can't record audio. Use Chrome or Safari.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunks.current, { type: (r.mimeType || "audio/webm").split(";")[0] });
        setBlob(b);
        if (preview.current) URL.revokeObjectURL(preview.current);
        preview.current = URL.createObjectURL(b);
        setPreviewUrl(preview.current);
        setState("review");
      };
      r.start(1000);
      rec.current = r;
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast("Microphone permission was denied. Allow it in your browser's site settings.", "error");
    }
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stop();
  };
  const save = async () => {
    if (!blob) return;
    setState("saving");
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.set("file", new File([blob], `voice.${ext}`, { type: blob.type }));
    form.set("durationSec", String(seconds));
    form.set("note", note);
    try {
      const r = await api<RecordingItem>(`/api/businesses/${businessId}/recordings`, { form });
      setRecordings([r, ...recordings]);
      setBlob(null);
      setNote("");
      setState("idle");
      toast("Recording saved on this Mac");
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save recording", "error");
      setState("review");
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this recording permanently?")) return;
    await api(`/api/recordings/${id}`, { method: "DELETE" });
    setRecordings(recordings.filter((r) => r.id !== id));
  };
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {state === "idle" ? (
        <button className="btn w-full" onClick={start}>
          <Mic size={14} /> Record voice note
        </button>
      ) : state === "recording" ? (
        <button className="btn w-full border-bad text-bad-ink" onClick={stop}>
          <Square size={12} className="fill-current" /> Stop recording · <span className="tabular">{mm(seconds)}</span>
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-line p-2.5">
          {previewUrl ? <audio controls src={previewUrl} className="h-9 w-full" /> : null}
          <input className="input" placeholder="What is this recording about? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-1.5">
            <button className="btn btn-sm" onClick={() => (setBlob(null), setState("idle"))}>
              Discard
            </button>
            <button className="btn btn-sm btn-primary" onClick={save} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Save recording"}
            </button>
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-muted">Records your microphone (e.g. an in-person meeting or a quick voice summary after a call). Only record people with their consent. Files stay in this CRM&apos;s data folder.</p>
      {recordings.length ? (
        <ul className="space-y-2">
          {recordings.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-2">
              <div className="mb-1 flex items-center justify-between text-[11.5px] text-muted">
                <span>
                  {formatDateTime(r.createdAt)} · {mm(r.durationSec)}
                </span>
                <button className="btn btn-ghost btn-sm h-6 px-1" onClick={() => remove(r.id)} title="Delete recording">
                  <Trash2 size={12} />
                </button>
              </div>
              <audio controls preload="none" src={r.url} className="h-9 w-full" />
              {r.note ? <p className="mt-1 text-[12px] text-ink-2">{r.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type GalleryImage = { url: string; source: string; id?: string; attribution?: string };

export function Photos({ businessId, name, images, onUploaded, onDeleted }: { businessId: string; name: string; images: GalleryImage[]; onUploaded: (p: PhotoItem) => void; onDeleted: (id: string) => void }) {
  const toast = useToast();
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);
  const visible = images.filter((i) => !broken[i.url]);
  const current = visible[Math.min(active, visible.length - 1)];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.set("file", f);
      try {
        const p = await api<PhotoItem>(`/api/businesses/${businessId}/photos`, { form });
        onUploaded(p);
        toast("Photo added");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Upload failed", "error");
      }
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-t-xl bg-surface-2" style={{ height: 190 }}>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={`${name}`} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [current.url]: true }))} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center text-muted">
            <Camera size={22} strokeWidth={1.6} />
            <span className="text-[12px]">No verified photo yet</span>
            <span className="text-[11px]">Upload your own, use “Check website”, or connect Google Places.</span>
          </div>
        )}
        {current ? (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-1.5 pt-6 text-[10.5px] text-white">
            {current.source}
            {current.attribution ? ` · ${current.attribution}` : ""}
          </span>
        ) : null}
        {current?.id ? (
          <button
            className="btn btn-sm absolute right-2 top-2 h-7 px-1.5"
            title="Delete this photo"
            onClick={async () => {
              if (!confirm("Delete this photo?")) return;
              await api(`/api/photos/${current.id}`, { method: "DELETE" });
              onDeleted(current.id!);
              setActive(0);
            }}
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto p-2">
        {visible.map((img, i) => (
          <button key={img.url} onClick={() => setActive(i)} className={cn("size-11 shrink-0 overflow-hidden rounded-md border", i === active ? "border-accent" : "border-line")} title={img.source}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [img.url]: true }))} />
          </button>
        ))}
        <button className="flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-muted hover:text-ink" onClick={() => input.current?.click()} title="Upload photos">
          <Upload size={15} />
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>
    </div>
  );
}

export function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [value, setValue] = useState("");
  const add = () => {
    const t = value.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setValue("");
  };
  return (
    <div className="flex min-h-[32px] flex-wrap items-center gap-1 rounded-lg border border-line-strong bg-surface px-1.5 py-1 focus-within:border-accent">
      {tags.map((t) => (
        <span key={t} className="badge gap-1 pr-1">
          {t}
          <button className="rounded hover:text-bad-ink" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        className="h-6 min-w-[80px] flex-1 bg-transparent px-1 text-[12.5px] outline-none"
        placeholder={tags.length ? "" : "Add tag + Enter"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !value && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        aria-label="Add tag"
      />
    </div>
  );
}
