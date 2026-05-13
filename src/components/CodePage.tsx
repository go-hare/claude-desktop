import React from 'react';
import { ChevronRight, Computer, Folder, Plus } from 'lucide-react';
import starSparkleImg from '../assets/figma-exports/cowork-icons/star-sparkle.png';

function SkeletonTile({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`rounded-[6px] bg-[#efeeeb] ${wide ? 'col-span-4 h-[148px]' : 'h-[36px]'}`} />
  );
}

export default function CodePage() {
  const skeletonWidth = 480;
  const contentWidth = 752;

  return (
    <div className="flex h-full w-full bg-[#fbfbf7] text-[#1f1f1e]">
      <div className="flex min-w-0 flex-1 flex-col items-center pb-[12px] pt-[28px]">
        <div className="w-full max-w-[752px]">
          <div className="mb-[44px] flex items-center gap-[12px]">
            <img
              alt=""
              aria-hidden="true"
              className="h-[18px] w-[18px] shrink-0"
              src={starSparkleImg}
            />
            <h1 className="text-[22px] font-semibold text-[#141413]">接下来做什么?</h1>
          </div>

          <div className="rounded-[12px] bg-[#f4f3f0] p-3" style={{ width: `${skeletonWidth}px` }}>
            <div className="grid grid-cols-4 gap-[4px]">
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile wide />
            </div>
          </div>
        </div>

        <div className="mt-auto w-full pb-[10px]">
          <div className="mx-auto w-full max-w-[752px]">
            <div className="mb-[8px] flex items-center gap-[6px]">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#ded9d1] bg-white px-3 text-[13px] text-[#5d584f] shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
              >
                <Computer size={13} />
                本地
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#ded9d1] bg-white px-3 text-[13px] text-[#5d584f] shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
              >
                <Folder size={13} />
                选择文件夹...
              </button>
            </div>

            <div
              className="border border-[rgba(31,31,30,0.15)] bg-white font-sans transition-all duration-200"
              style={{
                borderRadius: '16px',
                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div className="px-[20px] py-[14px]">
                <div className="relative min-h-[28px]">
                  <textarea
                    className="min-h-[28px] w-full resize-none border-0 bg-transparent p-0 text-[16px] font-normal leading-[24px] tracking-[-0.3125px] text-[#373734] outline-none placeholder:text-[#b1aca4]"
                    placeholder="描述任务或提出问题"
                    rows={1}
                  />
                </div>
              </div>

              <div className="mt-[10px] flex h-[32px] items-center justify-between px-[4px] pb-[2px]">
                <div className="flex items-center gap-[10px] text-[13px] text-[#6d675f]">
                  <button type="button" className="transition-colors hover:text-[#1f1f1e]">
                    接受编辑
                  </button>
                  <button type="button" className="text-[16px] transition-colors hover:text-[#1f1f1e]">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-[8px] text-[13px] text-[#6d675f]">
                  <span>Opus 4.6 · 中</span>
                  <button type="button" className="rounded-full border border-[#d8d3cb] p-1 text-[#7a756d] transition-colors hover:text-[#1f1f1e]">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
