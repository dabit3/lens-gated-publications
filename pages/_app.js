import '../styles/globals.css'
import Link from 'next/link'
import { css } from '@emotion/css'

function MyApp({ Component, pageProps }) {
  return (
    <div className={navContainerStyle}>
      <nav>
        <Link href="/" className={linkStyle}>
          Home
        </Link>
        <Link href="/feed" className={linkStyle}>
          Feed
        </Link>
        <Link href="/decrypt-publication" className={linkStyle}>
          Decrypt publication
        </Link>
        <a className={linkStyle} href="https://github.com/dabit3/lens-token-gating" target="_blank" rel="noopener noreferrer">
          Code
        </a>
      </nav>
      <div className={containerStyle}>
        <div className={wrapperStyle}>
          <Component {...pageProps} />
        </div>
      </div>
    </div>
  )
}

const navContainerStyle = css`
  padding: 20px 120px;
`

const linkStyle = css`
  margin-left: 20px;
`

const wrapperStyle = css`
  width: 900px;
  padding-top: 50px;
`

const containerStyle = css`
  display: flex;
  justify-content: center;
`

export default MyApp
