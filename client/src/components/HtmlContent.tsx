import { cn } from '@/lib/utils';

interface HtmlContentProps {
  html: string;
  className?: string;
}

const HtmlContent = ({ html, className }: HtmlContentProps) => {
  return (
    <div 
      className={cn("prose max-w-none", className)} 
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

export default HtmlContent;