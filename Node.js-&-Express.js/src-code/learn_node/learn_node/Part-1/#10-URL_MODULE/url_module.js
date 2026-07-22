function runUrlDemo(){
    // >> how to create url object from url string
    const apiUrl = new URL("https://api.ginghub.com/users?page=2&limit=10&sort=latest")

    console.log(apiUrl.href, apiUrl.protocol, apiUrl.hostname, apiUrl.pathname, apiUrl.search)

    // ? 
    const page = apiUrl.searchParams.get('page')
    const limit = apiUrl.searchParams.get('limit')
    const sort = apiUrl.searchParams.get('sort')
    apiUrl.searchParams.set('sort', '10')

    console.log(page, limit, sort)

    const queryParams = new URLSearchParams({
        search: "node js",
        page: "1",
        limit: "5"
    })

    console.log(queryParams.toString());
}
runUrlDemo()