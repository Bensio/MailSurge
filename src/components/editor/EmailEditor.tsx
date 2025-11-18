import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import EmailEditor from 'react-email-editor';
import { logger } from '@/lib/logger';

interface EmailEditorWrapperProps {
  onSave: (design: unknown) => void;
  initialDesign?: unknown;
}

export interface EmailEditorRef {
  exportDesign: () => void;
}

export const EmailEditorWrapper = forwardRef<EmailEditorRef, EmailEditorWrapperProps>(
  ({ onSave, initialDesign }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailEditorRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    const onLoad = () => {
      logger.debug('EmailEditor', 'Editor loaded');
      setIsReady(true);
      if (initialDesign && emailEditorRef.current) {
        const editor = emailEditorRef.current.editor || emailEditorRef.current;
        if (editor && typeof editor.loadDesign === 'function') {
          editor.loadDesign(initialDesign);
        }
      }
    };

    const exportHtml = useCallback(() => {
      if (!emailEditorRef.current) {
        logger.warn('Email editor ref not available');
        return;
      }

      if (!isReady) {
        logger.warn('Email editor not loaded yet');
        return;
      }

      // The Unlayer editor exposes methods on the 'editor' property
      // Try multiple ways to access the editor
      let editor = emailEditorRef.current;
      
      // Check if there's an 'editor' property
      if (editor && editor.editor) {
        editor = editor.editor;
      }
      
      // Check if exportHtml method exists
      if (!editor || typeof editor.exportHtml !== 'function') {
        logger.warn('exportHtml is not a function. Editor might not be fully loaded.');
        
        // Try alternative method name
        if (editor && typeof editor.exportHtmlAsync === 'function') {
          logger.debug('EmailEditor', 'Trying exportHtmlAsync');
          editor.exportHtmlAsync().then((data: { design: unknown; html: string }) => {
            onSave({
              design: data.design,
              html: data.html,
            });
          }).catch((error: Error) => {
            logger.error('Error exporting HTML async:', error);
          });
          return;
        }
        
        return;
      }

      try {
        logger.debug('EmailEditor', 'Calling exportHtml');
        editor.exportHtml((data: { design: unknown; html: string }) => {
          logger.debug('EmailEditor', 'Export callback received', { htmlLength: data.html?.length });
          // Save both the design (for future editing) and the HTML
          onSave({
            design: data.design,
            html: data.html,
          });
        });
      } catch (error) {
        logger.error('Error exporting HTML:', error);
      }
    }, [onSave, isReady]);

    useImperativeHandle(ref, () => ({
      exportDesign: exportHtml,
    }));

    useEffect(() => {
      // Also expose to window for backward compatibility
      (window as unknown as { exportEmailDesign?: () => void }).exportEmailDesign = exportHtml;
    }, [exportHtml]);

    return (
      <div className="w-full h-screen">
        <EmailEditor
          ref={emailEditorRef}
          onLoad={onLoad}
          options={{
            locale: 'en',
            appearance: {
              theme: 'light',
            },
          }}
        />
      </div>
    );
  }
);

EmailEditorWrapper.displayName = 'EmailEditorWrapper';
