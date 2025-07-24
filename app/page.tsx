import LoginButton from "./components/LoginButton";

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f5f6fa"
    }}>
      <LoginButton />
    </div>
  );
}
