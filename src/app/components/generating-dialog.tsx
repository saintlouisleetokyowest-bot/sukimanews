import { Mic, CheckCircle2, Circle } from "lucide-react";
import { motion } from "motion/react";

interface GeneratingDialogProps {
  currentStep: "fetching" | "generating" | "synthesizing";
  onCancel: () => void;
}

const steps = [
  { id: "fetching", label: "ニュースを取得中..." },
  { id: "generating", label: "スクリプトを生成中..." },
  { id: "synthesizing", label: "音声を合成中..." },
];

export function GeneratingDialog({ currentStep, onCancel }: GeneratingDialogProps) {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mic className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-center">ニュースを生成中...</h2>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            return (
              <div key={step.id} className="flex items-center gap-3">
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex-shrink-0"
                  >
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </motion.div>
                )}
                {isCurrent && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="flex-shrink-0"
                  >
                    <Circle className="w-6 h-6 text-primary" strokeWidth={3} />
                  </motion.div>
                )}
                {isPending && (
                  <div className="flex-shrink-0">
                    <Circle className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
                <span
                  className={`text-sm ${
                    isCurrent
                      ? "text-foreground font-medium"
                      : isComplete
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time Estimate */}
        <p className="text-sm text-muted-foreground text-center">予想時間: 約30秒</p>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full py-3 text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium"
        >
          キャンセル
        </button>
      </motion.div>
    </div>
  );
}
