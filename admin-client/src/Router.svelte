<script>
  import page from 'page';
  import { get } from 'svelte/store';
  import { router, session } from './stores';
  import * as Pages from './pages';

  let currentPage;
  let redirect;

  function queryString(ctx, next) {
    ctx.query = {};
    new URLSearchParams(ctx.querystring)
      .forEach((v, k) => { ctx.query[k] = v; });
    next();
  }

  function ensureAuthenticated(ctx, next) {
    if (get(session).authenticated) next();
    else {
      redirect = ctx.path;
      page.redirect('/login');
    }
  }

  function ensureUnauthenticated(ctx, next) {
    if (!get(session).authenticated) next();
    else page.redirect('/');
  }

  function checkRedirect(ctx, next) {
    if (!redirect) next();
    else {
      page.redirect(redirect);
      redirect = null;
    }
  }

  function render(component) {
    return (ctx) => {
      currentPage = component;
      router.setContext(ctx);
    };
  }

  // Routes
  page('/login', ensureUnauthenticated, render(Pages.Login));

  // Authenticated Routes
  page('*', ensureAuthenticated);
  page('/', checkRedirect, render(Pages.Home));
  page('/sites/:id', queryString, render(Pages.Site));
  page('/sites', queryString, render(Pages.Sites));
  page('/builds', queryString, render(Pages.Builds));
  page('*', render(Pages.NotFound));
  page();
</script>

{#if currentPage}
  <svelte:component this={currentPage} />
{/if}
