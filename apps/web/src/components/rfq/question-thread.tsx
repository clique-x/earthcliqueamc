"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { RequirementQuestion } from "@/lib/rfq-types";

type Props = {
  questions: RequirementQuestion[];
  /** Company side: answer a question. */
  onAnswer?: (questionId: string, answer: string) => Promise<void>;
  /** Vendor side: ask a question. */
  onAsk?: (question: string) => Promise<void>;
  description?: string;
};

/** Q&A between vendors and the company. Answers are shown to every invited vendor. */
export function QuestionThread({ questions, onAnswer, onAsk, description }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!onAsk) return;
    setBusy(true);
    try {
      await onAsk(draft.trim());
      setDraft("");
      toast.success("Question sent to the company");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions & answers</CardTitle>
        <CardDescription>{description ?? "Answers are visible to every vendor who received this requirement."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {questions.map((q) => (
          <div key={q.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">
              {q.question}
              {q.mine && <span className="ml-2 text-xs font-normal text-primary">(your question)</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {q.vendorName ?? "A vendor"} · {formatDateTime(q.askedAt)}
            </p>
            {q.answer ? (
              <div className="mt-2 rounded-md bg-primary/5 p-2">
                <p className="whitespace-pre-wrap">{q.answer}</p>
                <p className="text-xs text-muted-foreground">Answered {formatDateTime(q.answeredAt)}</p>
              </div>
            ) : onAnswer ? (
              <AnswerBox onSubmit={(a) => onAnswer(q.id, a)} />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Waiting for the company to answer.</p>
            )}
          </div>
        ))}
        {onAsk && (
          <div className="space-y-2">
            <Textarea placeholder="Ask the company a question (e.g. existing cabling, site access hours)" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={2} />
            <Button size="sm" disabled={busy || draft.trim().length < 5} onClick={ask}>
              Ask question
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnswerBox({ onSubmit }: { onSubmit: (answer: string) => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 space-y-2">
      <Textarea placeholder="Your answer (shown to all invited vendors)" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={2000} rows={2} />
      <Button
        size="sm"
        disabled={busy || answer.trim().length === 0}
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(answer.trim());
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        Post answer
      </Button>
    </div>
  );
}
