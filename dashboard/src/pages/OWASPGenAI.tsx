import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/owasp-genai.md'

export default function OWASPGenAI() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load OWASP Gen-AI document." />
}
