import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/owasp-llm.md'

export default function OWASPLLM() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load OWASP Top 10 LLM document." />
}
