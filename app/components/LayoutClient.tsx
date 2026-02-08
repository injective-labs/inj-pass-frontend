'use client';

export function SidebarOverlay() {
  const handleClick = () => {
    document.body.classList.toggle('sidebar-mode');
  };

  return <div className="sidebar-overlay" onClick={handleClick}></div>;
}

export function GeometricShapes() {
  return (
    <>
      <div className="animated-background"></div>
    </>
  );
}
