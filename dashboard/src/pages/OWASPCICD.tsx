import MarkdownDocPage from '../components/MarkdownDocPage'

const URL = 'https://raw.githubusercontent.com/arnoldcastro5000/prowler-cspm-demo/main/docs/owasp-cicd.md'

export default function OWASPCICD() {
  return <MarkdownDocPage url={URL} errorLabel="Failed to load OWASP Top 10 CI/CD document." />
}
