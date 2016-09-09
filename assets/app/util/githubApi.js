
import fetch from './fetch';

import store from '../store';
import { encodeB64, decodeB64 } from './encoding';
import alertActions from '../actions/alertActions';

const API = 'https://api.github.com';

function getToken() {
  const state = store.getState();
  const passports = state.user.passports;
  let github = passports.filter((passport) => {
    return passport.provider === 'github';
  }).pop();

  return github.tokens.accessToken;
}

function getRepoFor(site) {
  return `repos/${site.owner}/${site.repository}`;
}

const github = {
  fetch(path, params) {
    const url = `${API}/${path}`;

    return fetch(url, params).then((data) => {
      return data;
    });
  },

  createCommit(site, path, commit) {
    let url = `${getRepoFor(site)}/contents/${path}`;

    return this.fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${getToken()}`
      },
      data: commit
    });
  },

  createBranch(site, branch, sha) {
    const url = `${getRepoFor(site)}/git/refs`;
    const data = {
      ref: `refs/heads/${branch}`,
      sha
    };

    return this.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${getToken()}`
      },
      data
    });
  },

  updateBranch(site, branch, sha) {
    const url = `${getRepoFor(site)}/git/refs/${branch}`;
    const data = {
      sha
    };

    return this.fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${getToken()}`
      },
      data
    });
  },

  deleteBranch(site, branch) {
    const url = `${getRepoFor(site)}/git/refs/heads/${branch}`;
    return this.fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${getToken()}`
      }
    });
  },

  fetchBranches(site) {
    const url = `${getRepoFor(site)}/branches`;
    const params = {
      access_token: getToken()
    };

    return this.fetch(url, { params });
  },

  fetchPullRequests(site) {
    const url = `${getRepoFor(site)}/pulls`;
    const params = {
      access_token: getToken()
    };

    return this.fetch(url, { params });
  },

  fetchRepositoryConfigs(site) {
    const configFiles = ['_config.yml', '_navigation.json'];

    const configFetches = configFiles.map((path) => {
      return this.fetchRepositoryContent(site, path);
    });

    return Promise.all(configFetches).then((configs) => {
      return configs.map((config) => {
        const content = (config) ? decodeB64(config.content) : false
        return Object.assign({}, config, { content });
      });
    }).then((configs) => {
      return configFiles.reduce((result, configFile, index) => {
        result[configFile] = configs[index]
        return result;
      }, {});
    });
  },

  fetchRepositoryContent(site, path = '') {
    const url = `${getRepoFor(site)}/contents/${path}`;
    const params = {
      access_token: getToken(),
      ref: site.branch || site.defaultBranch
    };

    return this.fetch(url, { params });
  },

  createPullRequest(site, branch, base) {
    const url = `${getRepoFor(site)}/pulls`;

    return this.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${getToken()}`
      },
      data: {
        title: `Merging ${branch} into ${base}`,
        head: branch,
        base: base
      }
    });
  },

  mergePullRequest(site, pr) {
    const url = `${getRepoFor(site)}/pulls/${pr.number}/merge`;
    const data = {
      commit_message: 'Merged by Federalist',
      sha: `${pr.head.sha}`
    };

    return this.fetch(url, {
      headers: {
        'Authorization': `token ${getToken()}`
      },
      method: 'PUT',
      data
    });
  },

  /**
   * creates a new github repo at the user's account
   * @param  {Object} destination Repo to be created
   *                              keys:
   *                              	repo: String:required
   *                              	organization: String (default to 'user')
   *                              	branch: String (default to 'master')
   *                              	engine: String (default to 'jekyll')
   *
   * }
   * @param  {Object} source      Repo to be cloned
   *                              keys:
   *                              	owner: String:required
   *                              	repo: String:required
   * @return {Promise}
   */
  createRepo(destination, source) {
    const token = getToken();
    /**
     * Issue an OPTIONS request to determine if the source repository to be
     * cloned exists on github.
     * @param  {String} owner Github username associated with the repo
     * @param  {String} repo  Name of the repository to be cloned
     * @return {Promise}
     */
    function checkSourceRepo(owner, repo) {
      const params = {
        access_token: token
      };
      const sourceUrl = `repos/${owner}/${repo}`;

      return github.fetch(sourceUrl, { params });
    }

    /**
     * Issue a POST request to github to create a new repository for the user
     * @param  {Object} destination keys:
     *                              	repo:String required
     *                              	organization:String
     * @return {Promise}
     */
    function createRepo(destination) {
      const org = destination.organization ?
        `orgs/${destination.organization}` : 'user';

      const repoUrl = `${org}/repos`;

      return github.fetch(repoUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`
        },
        data: {
          name: destination.repo
        }
      });
    }

    return checkSourceRepo(source.owner, source.repo)
      .then(() => createRepo(destination));
  }
}

export default github;
