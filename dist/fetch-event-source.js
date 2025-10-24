// src/parse.ts
async function getBytes(stream, onChunk) {
  const reader = stream.getReader();
  let result;
  while (!(result = await reader.read()).done) {
    onChunk(result.value);
  }
}
function getLines(onLine) {
  let buffer;
  let position;
  let fieldLength;
  let discardTrailingNewline = false;
  return function onChunk(arr) {
    if (buffer === void 0) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      buffer = concat(buffer, arr);
    }
    const bufLength = buffer.length;
    let lineStart = 0;
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === 10 /* NewLine */) {
          lineStart = ++position;
        }
        discardTrailingNewline = false;
      }
      let lineEnd = -1;
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case 58 /* Colon */:
            if (fieldLength === -1) {
              fieldLength = position - lineStart;
            }
            break;
          // @ts-ignore:7029 \r case below should fallthrough to \n:
          case 13 /* CarriageReturn */:
            discardTrailingNewline = true;
          case 10 /* NewLine */:
            lineEnd = position;
            break;
        }
      }
      if (lineEnd === -1) {
        break;
      }
      onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
      lineStart = position;
      fieldLength = -1;
    }
    if (lineStart === bufLength) {
      buffer = void 0;
    } else if (lineStart !== 0) {
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
}
function getMessages(onId, onRetry, onMessage) {
  let message = newMessage();
  const decoder = new TextDecoder();
  return function onLine(line, fieldLength) {
    if (line.length === 0) {
      onMessage?.(message);
      message = newMessage();
    } else if (fieldLength > 0) {
      const field = decoder.decode(line.subarray(0, fieldLength));
      const valueOffset = fieldLength + (line[fieldLength + 1] === 32 /* Space */ ? 2 : 1);
      const value = decoder.decode(line.subarray(valueOffset));
      switch (field) {
        case "data":
          message.data = message.data ? message.data + "\n" + value : value;
          break;
        case "event":
          message.event = value;
          break;
        case "id":
          onId(message.id = value);
          break;
        case "retry":
          const retry = parseInt(value, 10);
          if (!isNaN(retry)) {
            onRetry(message.retry = retry);
          }
          break;
      }
    }
  };
}
function concat(a, b) {
  const res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
}
function newMessage() {
  return {
    data: "",
    event: "",
    id: "",
    retry: void 0
  };
}

// src/fetch.ts
var EventStreamContentType = "text/event-stream";
var DefaultRetryInterval = 1e3;
var LastEventId = "last-event-id";
function fetchEventSource(input, {
  signal: inputSignal,
  headers: inputHeaders,
  onopen: inputOnOpen,
  onmessage,
  onclose,
  onerror,
  openWhenHidden,
  fetch: inputFetch,
  ...rest
}) {
  return new Promise((resolve, reject) => {
    const headers = { ...inputHeaders };
    if (!headers.accept) {
      headers.accept = EventStreamContentType;
    }
    let curRequestController;
    function onVisibilityChange() {
      curRequestController.abort();
      if (!document.hidden) {
        create();
      }
    }
    if (!openWhenHidden) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    let retryInterval = DefaultRetryInterval;
    let retryTimer = 0;
    function dispose() {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearTimeout(retryTimer);
      curRequestController.abort();
    }
    inputSignal?.addEventListener("abort", () => {
      dispose();
      resolve();
    });
    const fetch = inputFetch ?? window.fetch;
    const onopen = inputOnOpen ?? defaultOnOpen;
    async function create() {
      curRequestController = new AbortController();
      try {
        const response = await fetch(input, {
          ...rest,
          headers,
          signal: curRequestController.signal
        });
        await onopen(response);
        await getBytes(response.body, getLines(getMessages((id) => {
          if (id) {
            headers[LastEventId] = id;
          } else {
            delete headers[LastEventId];
          }
        }, (retry) => {
          retryInterval = retry;
        }, onmessage)));
        onclose?.();
        dispose();
        resolve();
      } catch (err) {
        if (!curRequestController.signal.aborted) {
          try {
            const interval = onerror?.(err) ?? retryInterval;
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(create, interval);
          } catch (innerErr) {
            dispose();
            reject(innerErr);
          }
        }
      }
    }
    create();
  });
}
function defaultOnOpen(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType?.startsWith(EventStreamContentType)) {
    throw new Error(`Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`);
  }
}
export {
  EventStreamContentType,
  fetchEventSource
};
//# sourceMappingURL=fetch-event-source.js.map
