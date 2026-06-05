import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/stride.md'

export default function STRIDE() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load STRIDE document." />
}
