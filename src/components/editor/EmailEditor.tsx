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
      // Load design after a short delay to ensure editor is fully initialized
      setTimeout(() => {
        if (initialDesign && emailEditorRef.current) {
          let editor = emailEditorRef.current;
          // Try multiple ways to access the editor
          if (editor && editor.editor) {
            editor = editor.editor;
          }
          if (editor && typeof editor.loadDesign === 'function') {
            logger.debug('EmailEditor', 'Loading design', { hasDesign: !!initialDesign });
            try {
              editor.loadDesign(initialDesign);
              logger.debug('EmailEditor', 'Design loaded successfully');
            } catch (error) {
              logger.error('EmailEditor', 'Error loading design:', error);
            }
          } else {
            logger.warn('EmailEditor', 'loadDesign method not available');
          }
        }
      }, 100);
    };

    // Also load design when initialDesign changes after editor is ready
    useEffect(() => {
      if (isReady && initialDesign && emailEditorRef.current) {
        let editor = emailEditorRef.current;
        if (editor && editor.editor) {
          editor = editor.editor;
        }
        if (editor && typeof editor.loadDesign === 'function') {
          logger.debug('EmailEditor', 'Loading design from useEffect', { hasDesign: !!initialDesign });
          try {
            editor.loadDesign(initialDesign);
          } catch (error) {
            logger.error('EmailEditor', 'Error loading design from useEffect:', error);
          }
        }
      }
    }, [isReady, initialDesign]);

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
            features: {
              preview: true,
              stockImages: true,
              undoRedo: true,
              textEditor: {
                spellChecker: true,
                tables: true,
                cleanPaste: true,
              },
            },
            // Note: Column drag-and-drop may have limitations in Unlayer
            // If you can't drag into left column, try:
            // 1. Click on the left column first to select it
            // 2. Use the "Add Block" button instead of drag-and-drop
            // 3. Drag content to the right column, then use copy/paste to move it
            mergeTags: {
              Company: {
                name: 'Company',
                value: '{{company}}',
                sample: 'Acme Corp',
              },
            },
            displayMode: 'email',
          }}
        />
      </div>
    );
  }
);

EmailEditorWrapper.displayName = 'EmailEditorWrapper';
