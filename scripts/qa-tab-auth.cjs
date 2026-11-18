exports.tabAuth = async page => {
    const proof = await page.evaluate(() => sessionStorage.getItem('nchef_tab_session'));
    return proof ? { 'X-NCHEF-Tab-Session': proof } : {};
};
