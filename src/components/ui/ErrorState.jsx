export function ErrorState({ message = 'Unable to load data.' }) {
  return <div role="alert">{message}</div>;
}
