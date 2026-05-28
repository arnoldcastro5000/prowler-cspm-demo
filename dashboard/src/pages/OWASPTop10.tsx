import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/owasp-top10.md'

export default function OWASPTop10() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load OWASP Top 10 document." />
}
