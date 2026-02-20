default
{
    touch_start(integer num_detected)
    {
        llSay(0, "Welcome! Touch me to buy a token.");
    }

    money(key id, integer amount)
    {
        if (amount >= 10)
        {
            llSay(0, "Thank you for your purchase!");
            llGiveInventory(id, "Token");
        }
        else
        {
            llSay(0, "Not enough! Tokens cost 10L$.");
        }
    }
}
