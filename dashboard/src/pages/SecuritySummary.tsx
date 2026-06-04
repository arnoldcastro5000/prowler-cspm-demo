import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/securitysummary.md'

export default function SecuritySummary() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load Security Summary document." />
}
