import html from '../index.html?raw';

describe('index.html', () => {
  it('shows a bilingual loading hint in #root until React renders, without external resources', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.getElementById('root');
    expect(root?.textContent).toMatch(/BOGEN wird geladen … \/ BOGEN is loading …/);
    expect(root?.querySelectorAll('[src], [href], link, img, script')).toHaveLength(0);
  });
});
