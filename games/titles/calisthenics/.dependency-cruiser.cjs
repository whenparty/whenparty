// Import rules of the architecture in AGENTS.md. `pnpm test` runs them.
module.exports = {
  forbidden: [
    {
      name: 'core-is-independent',
      comment: 'src/core/ is the game mechanics and imports no connection or frontend code.',
      severity: 'error',
      from: {path: '^src/core/'},
      to: {path: '^src/(connection\\.ts$|frontends/)'}
    },
    {
      name: 'core-has-no-runtime-platform-or-three',
      comment: 'src/core/ has no browser, network or three.js code; it may use types of the P2P platform.',
      severity: 'error',
      from: {path: '^src/core/'},
      to: {path: ['/platform/p2p/', '/node_modules/three/'], dependencyTypesNot: ['type-only']}
    },
    {
      name: 'connection-uses-only-core',
      comment: 'src/connection.ts imports only src/core/ from the game.',
      severity: 'error',
      from: {path: '^src/connection\\.ts$'},
      to: {path: '^src/frontends/'}
    },
    {
      name: 'shared-stays-shared',
      comment: 'src/frontends/shared/ serves every frontend and imports none of them.',
      severity: 'error',
      from: {path: '^src/frontends/shared/'},
      to: {path: '^src/frontends/(?!shared/)'}
    },
    {
      name: 'shared-uses-connection-types-only',
      comment: 'src/frontends/shared/ gets the room and its actions from the frontend, so it imports only types from src/connection.ts.',
      severity: 'error',
      from: {path: '^src/frontends/shared/'},
      to: {path: '^src/connection\\.ts$', dependencyTypesNot: ['type-only']}
    },
    {
      name: 'frontends-are-separate',
      comment: 'A frontend imports nothing from another frontend; code that two frontends use goes to src/frontends/shared/.',
      severity: 'error',
      from: {path: '^src/frontends/([^/]+)/', pathNot: '^src/frontends/shared/'},
      to: {path: '^src/frontends/', pathNot: ['^src/frontends/$1/', '^src/frontends/shared/']}
    },
    {
      name: 'imports-resolve',
      comment: 'Every import resolves, so the rules above see the whole graph.',
      severity: 'error',
      from: {},
      to: {couldNotResolve: true}
    }
  ],
  options: {
    parser: 'swc',
    doNotFollow: {path: ['node_modules', '^\\.\\./']},
    enhancedResolveOptions: {exportsFields: ['exports'], conditionNames: ['import', 'default'], mainFields: ['module', 'main']}
  }
}
