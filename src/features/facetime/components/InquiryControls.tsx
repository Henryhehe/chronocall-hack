import React from 'react';
import { INQUIRIES, getInquiry, type InquiryId } from '../../../../shared/inquiry.ts';

export function InquiryChooser({ inquiry, prediction, onInquiryChange, onPredictionChange }: {
  inquiry: InquiryId; prediction: string; onInquiryChange: (id: InquiryId) => void; onPredictionChange: (value: string) => void;
}) {
  const selected = getInquiry(inquiry);
  return <section className="inquiry-chooser" aria-labelledby="inquiry-heading">
    <div><p className="eyebrow">A question worth exploring</p><h2 id="inquiry-heading">Go into the call with a hunch.</h2></div>
    <div className="inquiry-options" role="group" aria-label="Choose an investigation">{INQUIRIES.map(i => <button key={i.id} type="button" aria-pressed={inquiry === i.id} onClick={() => onInquiryChange(i.id)}>{i.title}</button>)}</div>
    <p className="inquiry-question">{selected.question}</p>
    <p className="inquiry-hint">{selected.observe}</p>
    <details className="inquiry-prediction"><summary>Make a first guess <span>optional</span></summary><label>Before the call, I think…<textarea maxLength={1200} rows={2} value={prediction} onChange={e => onPredictionChange(e.target.value)} placeholder="Keep this thought. You’ll compare it with what you observe afterward." /></label></details>
    <p className="inquiry-hint">Choose a person below, or scan an artwork. After the call, separate what you saw, what they said, and what you can support.</p>
  </section>;
}

export function InquiryInCall({ inquiry, prediction, originalImage, onDraftQuestion }: {
  inquiry: InquiryId; prediction: string; originalImage: string | null; onDraftQuestion: (question: string) => void;
}) {
  const selected = getInquiry(inquiry);
  return <details className="inquiry-in-call" open>
    <summary>Your investigation · {selected.title}</summary>
    <p className="inquiry-question">{selected.question}</p>
    {prediction && <p><strong>Your first guess:</strong> {prediction}</p>}
    {originalImage && <details><summary>Look again at the original image</summary><img src={originalImage} alt="Original image chosen for this encounter, before portrait generation" /><p>This is the selected artwork/reference image. The animated call portrait is an AI interpretation.</p></details>}
    <p><strong>Try it:</strong> {selected.tryIt}</p>
    <button type="button" className="ui-button" onClick={() => onDraftQuestion(selected.ask)}>Draft a question</button>
    <p><strong>Think about:</strong> {selected.compare}</p>
    <p className="inquiry-hint">Pause to notice what you still want to find out.</p>
  </details>;
}
