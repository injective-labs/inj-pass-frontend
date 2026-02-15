/**
 * Web NFC API Type Definitions
 * 
 * Experimental Web API for NFC on Android Chrome
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
 */

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: BufferSource;
  encoding?: string;
  lang?: string;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFReader extends EventTarget {
  onreading: ((this: NDEFReader, event: NDEFReadingEvent) => any) | null;
  onreadingerror: ((this: NDEFReader, error: Event) => any) | null;
  scan(options?: NDEFScanOptions): Promise<void>;
  write(message: NDEFMessageSource, options?: NDEFWriteOptions): Promise<void>;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

type NDEFMessageSource = string | BufferSource | NDEFMessageInit;

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFRecordInit {
  recordType: string;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: any;
}

declare var NDEFReader: {
  prototype: NDEFReader;
  new(): NDEFReader;
};

interface Window {
  NDEFReader?: typeof NDEFReader;
}
