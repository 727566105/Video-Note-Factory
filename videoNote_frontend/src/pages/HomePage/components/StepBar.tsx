import { FC } from 'react'

interface Step {
  label: string
  key: string
  Icon?: React.ReactNode
}

interface StepBarProps {
  steps: Step[]
  currentStep: string
}

const StepBar: FC<StepBarProps> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex(step => step.key === currentStep)
  const currentStepData = steps[currentIndex]
  const progress = ((currentIndex + 1) / steps.length) * 100

  return (
    <>
      {/* 桌面端完整步骤条 */}
      <div className="hidden w-full items-center justify-between md:flex">
        {steps.map((step, index) => {
          const isActive = index <= currentIndex
          const isCurrent = index === currentIndex
          return (
            <div key={step.key} className="relative flex flex-1 flex-col items-center">
              <div className="relative flex flex-col items-center justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    isActive ? 'bg-primary text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                {isCurrent && step.Icon && (
                  <div className="absolute top-10 h-16 w-16">{step.Icon}</div>
                )}
              </div>

              <div className="mt-4 text-center text-xs text-gray-700">{step.label}</div>

              <div className={`h-1 w-full ${isActive ? 'bg-primary' : 'bg-gray-300'}`}></div>
            </div>
          )
        })}
      </div>

      {/* 移动端简化版本 */}
      <div className="flex w-full flex-col gap-3 px-4 md:hidden">
        {/* 步骤标题和进度 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
              {currentIndex + 1}
            </div>
            <span className="text-base font-semibold text-gray-800">
              {currentStepData?.label || '准备中'}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {currentIndex + 1}/{steps.length}
          </span>
        </div>

        {/* 进度条 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 步骤点指示器 */}
        <div className="flex items-center justify-between px-1">
          {steps.map((step, index) => {
            const isActive = index <= currentIndex
            const isCurrent = index === currentIndex
            return (
              <div
                key={step.key}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'bg-primary scale-125'
                    : isActive
                      ? 'bg-primary/60'
                      : 'bg-gray-300'
                }`}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}

export default StepBar