'use client';

export default function GlobalError({ reset }: { reset: () => void }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <h2>Something went wrong.</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
