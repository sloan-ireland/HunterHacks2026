export default function AuthPanel({
  user,
  loading,
  error,
  saveStatus,
  saveError,
  pendingSyncChoice,
  onUseLocalPlan,
  onLoadAccountPlan,
  onSignIn,
  onSignOut,
}) {
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    "Signed in";

  return (
    <div className="auth-card">
      <span className="metric-label">Account</span>

      {user ? (
        <>
          <strong>{displayName}</strong>
          <span>{user.email}</span>
          {saveStatus ? <span className="auth-save-status">{saveStatus}</span> : null}
          {pendingSyncChoice ? (
            <div className="sync-choice">
              <span>Local changes and account plan differ.</span>
              <button type="button" className="auth-button" onClick={onUseLocalPlan}>
                Save local plan
              </button>
              <button type="button" className="auth-button secondary" onClick={onLoadAccountPlan}>
                Load account plan
              </button>
            </div>
          ) : null}
          <button type="button" className="auth-button secondary" onClick={onSignOut} disabled={loading}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <strong>Not signed in</strong>
          <span>Sign in to save this plan to your account and bring it back later.</span>
          <button type="button" className="auth-button" onClick={onSignIn} disabled={loading}>
            {loading ? "Connecting..." : "Sign in with Google"}
          </button>
        </>
      )}

      {error ? <span className="auth-error">{error}</span> : null}
      {saveError ? <span className="auth-error">{saveError}</span> : null}
    </div>
  );
}
