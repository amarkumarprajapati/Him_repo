import { Sidebar } from '@/components/layout/sidebar';
import { TopHeader } from '@/components/layout/top-header';
import { MainWrapper } from '@/components/layout/main-wrapper';

export default function MapViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-700 dark:bg-[#04080F] dark:text-slate-300 font-sans transition-colors duration-150">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader />
        <MainWrapper>
          {children}
        </MainWrapper>
      </div>
    </div>
  );
}
