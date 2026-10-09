import { useState } from "react";
import { HELP_TOPICS, HELP_FAQ } from "@/data/helpContent";
import { useWorkbench } from "@/store/workbench";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Search } from "lucide-react";

export function HelpDialog() {
  const topicId = useWorkbench(s => s.helpTopic);
  const [query, setQuery] = useState("");
  const mappedId = topicId === "fit" ? "equipment" : topicId === "preview" ? "export" : topicId;
  const topic = HELP_TOPICS.find(t => t.id === mappedId) ?? HELP_TOPICS[0];
  const q = query.toLocaleLowerCase("ru");
  return <Dialog open={topicId !== null} onOpenChange={open => { if (!open) { useWorkbench.setState({ helpTopic: null }); setQuery(""); } }}>
    <DialogContent className="help-dialog max-w-4xl w-[calc(100%-24px)] max-h-[90dvh] overflow-auto">
      <DialogTitle className="flex items-center gap-2"><BookOpen size={20} /> Инструкция и FAQ</DialogTitle>
      <DialogDescription>Справка работает без интернета. Названия действий совпадают с интерфейсом.</DialogDescription>
      <label className="workbench-search"><Search size={16} /><input aria-label="Поиск в справке" placeholder="Найти ответ или инструкцию…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="help-layout">
        <nav aria-label="Разделы инструкции" className="space-y-1">
          {HELP_TOPICS.filter(t => !q || `${t.title} ${t.summary} ${t.steps.join(" ")}`.toLocaleLowerCase("ru").includes(q)).map(t =>
            <button key={t.id} className={`help-topic ${topic.id === t.id ? "active" : ""}`} aria-current={topic.id === t.id ? "page" : undefined} onClick={() => useWorkbench.setState({ helpTopic: t.id })}>{t.title}</button>)}
          <button className={`help-topic ${topicId === "faq" ? "active" : ""}`} onClick={() => useWorkbench.setState({ helpTopic: "faq" })}>Частые вопросы</button>
        </nav>
        <article className="help-article">
          {topicId !== "faq" && !q && <><h2>{topic.title}</h2><p>{topic.summary}</p><ol>{topic.steps.map(step => <li key={step}>{step}</li>)}</ol></>}
          {q && HELP_TOPICS.filter(t => `${t.title} ${t.summary} ${t.steps.join(" ")}`.toLocaleLowerCase("ru").includes(q)).map(t => <section key={t.id}><h2>{t.title}</h2><p>{t.summary}</p><ol>{t.steps.map(step => <li key={step}>{step}</li>)}</ol></section>)}
          {(topicId === "faq" || q) && <><h2>Частые вопросы</h2>{HELP_FAQ.filter(f => !q || `${f.question} ${f.answer}`.toLocaleLowerCase("ru").includes(q)).map(f => <details key={f.question} open={!!q}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</>}
          {q && !HELP_TOPICS.some(t => `${t.title} ${t.summary} ${t.steps.join(" ")}`.toLocaleLowerCase("ru").includes(q)) && !HELP_FAQ.some(f => `${f.question} ${f.answer}`.toLocaleLowerCase("ru").includes(q)) && <p>Ничего не найдено. Попробуйте «сохранение», «слой» или «экспорт».</p>}
        </article>
      </div>
    </DialogContent>
  </Dialog>;
}
