import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="center">
      <div className="u-title">Page not found</div>
      <Link to="/">Go home</Link>
    </div>
  );
}
