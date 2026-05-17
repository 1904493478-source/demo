import React from "react";

type ArrangementSelfMessageRecognizerProps = {
  onRecognize: (message: string) => boolean | Promise<boolean>;
};

export function ArrangementSelfMessageRecognizer({
  onRecognize,
}: ArrangementSelfMessageRecognizerProps) {
  const [message, setMessage] = React.useState("");
  const [feedback, setFeedback] = React.useState("AI 只会先生成候选安排，不会直接创建。");
  const [isRecognizing, setIsRecognizing] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRecognizing) return;

    setIsRecognizing(true);
    setFeedback("正在识别候选安排。");

    const recognized = await onRecognize(message);
    setIsRecognizing(false);

    if (recognized) {
      setMessage("");
      setFeedback("已生成候选安排，请先确认。");
      return;
    }

    setFeedback("没有生成候选，可以手动新建。");
  };

  return (
    <section
      aria-label="发给自己识别"
      className="rounded-[12px] border border-border bg-surface px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-text">发给自己</h2>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            先试一句真实消息，识别结果会进入候选区。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-xs leading-4 text-text-muted">
          V0.2
        </span>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="arrangements-self-message-input">
          发给自己的消息
        </label>
        <input
          id="arrangements-self-message-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="例如：后天去一趟医院"
          data-testid="arrangements-self-message-input"
          className="min-w-0 flex-1 rounded-[10px] border border-input-border bg-input-bg px-3 py-2 text-sm leading-5 text-text outline-none transition duration-150 placeholder:text-input-placeholder focus:border-input-border-focus focus:bg-input-bg-focus focus:shadow-focus"
        />
        <button
          type="submit"
          data-testid="arrangements-self-message-recognize"
          disabled={isRecognizing}
          className="shrink-0 rounded-[10px] bg-primary px-3 py-2 text-sm font-semibold leading-5 text-on-primary transition duration-150 focus-visible:shadow-focus focus-visible:outline-none active:scale-[0.98]"
        >
          {isRecognizing ? "识别中" : "识别"}
        </button>
      </form>
      <p
        data-testid="arrangements-self-message-feedback"
        className="mt-2 text-xs leading-5 text-text-tertiary"
      >
        {feedback}
      </p>
    </section>
  );
}
