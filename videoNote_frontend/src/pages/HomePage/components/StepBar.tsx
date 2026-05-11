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
          const isLast = index === steps.length - 1
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
      <div className="flex w-full items-center justify-center gap-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {currentIndex + 1}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {currentStepData?.label || '准备中'}
          </span>
        </div>
        <div className="flex-1">
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-gray-500">{currentIndex + 1}/{steps.length}</span>
      </div>
    </>
  )
}

export default StepBar