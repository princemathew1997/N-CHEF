module.exports=async function openNavigation(page,selector){
    const target=page.locator('.nav-menu '+selector);
    if(!await target.isVisible()){
        const group=page.locator('.nav-workgroup').filter({has:page.locator(selector)});
        await group.locator('.nav-group-toggle').click();
    }
    await target.click();
};
