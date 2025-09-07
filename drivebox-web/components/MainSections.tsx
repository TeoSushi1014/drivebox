import React, { useRef, useEffect, useState } from 'react';
import { Language } from '../types';
import { getTranslation } from '../constants';

interface MainSectionsProps {
  language: Language;
}

const SectionWrapper: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);
  
  const animationClass = isVisible ? 'animate-fade-in' : 'opacity-0';

  return (
    <section 
      id={id} 
      ref={sectionRef}
      className={`py-20 ${animationClass} ${className || 'bg-white/10 dark:bg-black/10 backdrop-blur-sm'}`}
    >
      {children}
    </section>
  );
};

const CopyButton: React.FC<{ text: string; language: Language }> = ({ text, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium ml-4"
    >
      {copied ? getTranslation(language, 'install', 'copied') : getTranslation(language, 'install', 'copyCommand')}
    </button>
  );
};

const MainSections: React.FC<MainSectionsProps> = ({ language }) => {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <SectionWrapper id="home" className="bg-transparent">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6 drop-shadow-2xl">
              {getTranslation(language, 'home', 'title')}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 dark:text-white/80 mb-8 leading-relaxed backdrop-blur-md bg-white/10 dark:bg-black/20 rounded-2xl p-6 border border-white/20 shadow-2xl">
              {getTranslation(language, 'home', 'subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <a 
                href="#install"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-2xl hover:shadow-blue-500/25 transform hover:-translate-y-1 backdrop-blur-sm border border-white/20"
              >
                {getTranslation(language, 'home', 'downloadNow')}
              </a>
              <a 
                href="#demo"
                className="px-8 py-4 border-2 border-white/30 text-white rounded-lg hover:bg-white/10 transition-all duration-300 font-semibold text-lg backdrop-blur-sm hover:border-white/50 transform hover:-translate-y-1"
              >
                {getTranslation(language, 'demo', 'watchVideo')}
              </a>
            </div>
            <div className="flex items-center justify-center space-x-6 text-sm text-white/80 backdrop-blur-md bg-white/10 dark:bg-black/20 rounded-2xl p-4 border border-white/20 max-w-2xl mx-auto">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {getTranslation(language, 'home', 'windowsOnly')}
              </span>
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Miễn phí & Mã nguồn mở
              </span>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Installation Section */}
      <SectionWrapper id="install" className="bg-white/10 dark:bg-black/10 backdrop-blur-md border-y border-white/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl mb-4">
              {getTranslation(language, 'install', 'title')}
            </h2>
            <p className="text-xl text-white/80 max-w-3xl mx-auto backdrop-blur-sm bg-white/10 dark:bg-black/20 rounded-xl p-4 border border-white/20">
              {getTranslation(language, 'install', 'subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Step 1 */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-black/20 p-6 rounded-xl border border-white/20 shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center mb-4 font-bold text-xl shadow-lg">1</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {getTranslation(language, 'install', 'step1Title')}
              </h3>
              <p className="text-white/80">
                {getTranslation(language, 'install', 'step1Desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-black/20 p-6 rounded-xl border border-white/20 shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg flex items-center justify-center mb-4 font-bold text-xl shadow-lg">2</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {getTranslation(language, 'install', 'step2Title')}
              </h3>
              <p className="text-white/80">
                {getTranslation(language, 'install', 'step2Desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-black/20 p-6 rounded-xl border border-white/20 shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg flex items-center justify-center mb-4 font-bold text-xl shadow-lg">3</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {getTranslation(language, 'install', 'step3Title')}
              </h3>
              <p className="text-white/80">
                {getTranslation(language, 'install', 'step3Desc')}
              </p>
            </div>

            {/* Step 4 */}
            <div className="backdrop-blur-md bg-white/10 dark:bg-black/20 p-6 rounded-xl border border-white/20 shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg flex items-center justify-center mb-4 font-bold text-xl shadow-lg">4</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {getTranslation(language, 'install', 'step4Title')}
              </h3>
              <p className="text-white/80">
                {getTranslation(language, 'install', 'step4Desc')}
              </p>
            </div>
          </div>

          {/* Installation Command */}
          <div className="bg-gray-900 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-400 mb-2">PowerShell (Chạy với quyền Administrator)</p>
                <code className="text-green-400 text-lg font-mono">
                  {getTranslation(language, 'install', 'installCommand')}
                </code>
              </div>
              <CopyButton text={getTranslation(language, 'install', 'installCommand')} language={language} />
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Demo Section */}
      <SectionWrapper id="demo" className="bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {getTranslation(language, 'demo', 'title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {getTranslation(language, 'demo', 'subtitle')}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
              <video 
                className="w-full aspect-video"
                controls
                preload="metadata"
                poster="./assets/video-poster.jpg"
                controlsList="nodownload"
              >
                <source src="./assets/video.mp4" type="video/mp4" />
                <p className="text-white text-center p-8">
                  Trình duyệt của bạn không hỗ trợ video HTML5. 
                  <a href="./assets/video.mp4" className="text-blue-400 underline ml-2">
                    Tải video trực tiếp
                  </a>
                </p>
              </video>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Tải Xuống Dễ Dàng</h3>
                <p className="text-gray-600 dark:text-gray-300">Tải về phần mềm thi bằng lái với tốc độ cao và khả năng tiếp tục khi gián đoạn</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Quản Lý Thông Minh</h3>
                <p className="text-gray-600 dark:text-gray-300">Tổ chức và quản lý tất cả phần mềm thi bằng lái từ một giao diện duy nhất</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Kiểm Tra Toàn Vẹn</h3>
                <p className="text-gray-600 dark:text-gray-300">Xác minh tính toàn vẹn của file với SHA-256 để đảm bảo an toàn</p>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Troubleshooting Section */}
      <SectionWrapper id="troubleshooting" className="bg-white dark:bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {getTranslation(language, 'troubleshooting', 'title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {getTranslation(language, 'troubleshooting', 'subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-700">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-3">
                {getTranslation(language, 'troubleshooting', 'dotnetIssue')}
              </h3>
              <p className="text-red-700 dark:text-red-300">
                {getTranslation(language, 'troubleshooting', 'dotnetSolution')}
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-700">
              <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-300 mb-3">
                {getTranslation(language, 'troubleshooting', 'adminIssue')}
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300">
                {getTranslation(language, 'troubleshooting', 'adminSolution')}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
              <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-3">
                {getTranslation(language, 'troubleshooting', 'networkIssue')}
              </h3>
              <p className="text-blue-700 dark:text-blue-300">
                {getTranslation(language, 'troubleshooting', 'networkSolution')}
              </p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* FAQ Section */}
      <SectionWrapper id="faq" className="bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {getTranslation(language, 'faq', 'title')}
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {getTranslation(language, 'faq', 'q1')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {getTranslation(language, 'faq', 'a1')}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {getTranslation(language, 'faq', 'q2')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {getTranslation(language, 'faq', 'a2')}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {getTranslation(language, 'faq', 'q3')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {getTranslation(language, 'faq', 'a3')}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {getTranslation(language, 'faq', 'q4')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {getTranslation(language, 'faq', 'a4')}
              </p>
            </div>
          </div>
        </div>
      </SectionWrapper>
    </main>
  );
};

export default MainSections;